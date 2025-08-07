from fastapi import APIRouter, HTTPException
from app.models.user import User
from typing import List

router = APIRouter()

@router.post("/users/", response_model=User)
async def create_user(user: User):
    # Logic to create a new user
    return user

@router.get("/users/", response_model=List[User])
async def read_users():
    # Logic to retrieve all users
    return []

@router.get("/users/{user_id}", response_model=User)
async def read_user(user_id: int):
    # Logic to retrieve a user by ID
    raise HTTPException(status_code=404, detail="User not found")

@router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: int, user: User):
    # Logic to update a user by ID
    return user

@router.delete("/users/{user_id}")
async def delete_user(user_id: int):
    # Logic to delete a user by ID
    return {"detail": "User deleted"}