from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import CommunityComment, CommunityPost, PostLike, User
from ..services.auth import get_current_user
from ..services.storage import save_image

router = APIRouter(prefix="/community", tags=["Community"])


class CreateCommentBody(BaseModel):
    content: str = Field(..., min_length=1)


def _author_brief(user: User | None) -> dict:
    if not user:
        return {"id": None, "full_name": "Unknown", "email": None}
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
    }


def _post_out(post: CommunityPost, liked: bool = False, include_comments: bool = False) -> dict:
    data = {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "image_url": post.image_url,
        "category": post.category,
        "likes_count": post.likes_count or 0,
        "comments_count": post.comments_count or 0,
        "liked_by_me": liked,
        "created_at": str(post.created_at),
        "updated_at": str(post.updated_at) if post.updated_at else None,
        "author": _author_brief(post.author),
    }
    if include_comments:
        data["comments"] = [
            {
                "id": c.id,
                "content": c.content,
                "created_at": str(c.created_at),
                "author": _author_brief(c.author),
            }
            for c in sorted(post.comments, key=lambda x: x.created_at or datetime.min)
        ]
    return data


async def _liked_post_ids(db: AsyncSession, user_id: str, post_ids: list[str]) -> set[str]:
    if not post_ids:
        return set()
    result = await db.execute(
        select(PostLike.post_id).where(
            PostLike.user_id == user_id,
            PostLike.post_id.in_(post_ids),
        )
    )
    return {row[0] for row in result.all()}


@router.get("/posts")
async def list_posts(
    page: int = 1,
    size: int = 20,
    category: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * size
    query = select(CommunityPost).options(selectinload(CommunityPost.author))
    count_query = select(func.count()).select_from(CommunityPost)

    if category:
        query = query.where(CommunityPost.category == category)
        count_query = count_query.where(CommunityPost.category == category)

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(
        query.order_by(desc(CommunityPost.created_at)).offset(offset).limit(size)
    )
    posts = result.scalars().all()
    liked = await _liked_post_ids(db, current_user.id, [p.id for p in posts])

    return {
        "items": [_post_out(p, liked=p.id in liked) for p in posts],
        "total": total,
        "page": page,
        "size": size,
    }


@router.get("/posts/{post_id}")
async def get_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CommunityPost)
        .options(
            selectinload(CommunityPost.author),
            selectinload(CommunityPost.comments).selectinload(CommunityComment.author),
        )
        .where(CommunityPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    liked = await _liked_post_ids(db, current_user.id, [post.id])
    return _post_out(post, liked=post.id in liked, include_comments=True)


@router.post("/posts")
async def create_post(
    title: str = Form(...),
    content: str = Form(...),
    category: str = Form("general"),
    file: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not title.strip() or not content.strip():
        raise HTTPException(status_code=400, detail="Title and content are required")

    image_url = None
    if file and file.filename:
        _, image_url = await save_image(file)

    post = CommunityPost(
        user_id=current_user.id,
        title=title.strip(),
        content=content.strip(),
        category=category or "general",
        image_url=image_url,
    )
    db.add(post)
    await db.commit()

    result = await db.execute(
        select(CommunityPost)
        .options(selectinload(CommunityPost.author))
        .where(CommunityPost.id == post.id)
    )
    post = result.scalar_one()
    return _post_out(post, liked=False)


@router.post("/posts/{post_id}/like")
async def toggle_like(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CommunityPost).where(CommunityPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    like_result = await db.execute(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user.id)
    )
    existing = like_result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        post.likes_count = max(0, (post.likes_count or 0) - 1)
        liked = False
    else:
        db.add(PostLike(post_id=post_id, user_id=current_user.id))
        post.likes_count = (post.likes_count or 0) + 1
        liked = True

    await db.commit()
    await db.refresh(post)
    return {"liked": liked, "likes_count": post.likes_count}


@router.post("/posts/{post_id}/comments")
async def add_comment(
    post_id: str,
    body: CreateCommentBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CommunityPost).where(CommunityPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = CommunityComment(
        post_id=post_id,
        user_id=current_user.id,
        content=body.content.strip(),
    )
    db.add(comment)
    post.comments_count = (post.comments_count or 0) + 1
    await db.commit()
    await db.refresh(comment)

    return {
        "id": comment.id,
        "content": comment.content,
        "created_at": str(comment.created_at),
        "author": _author_brief(current_user),
        "comments_count": post.comments_count,
    }


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CommunityPost).where(CommunityPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can delete this post")

    await db.delete(post)
    await db.commit()
    return {"message": "Post deleted"}
