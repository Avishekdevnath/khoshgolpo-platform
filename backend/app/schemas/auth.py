from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserOut


class AuthRegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=6, max_length=128)
    fav_animal: str | None = Field(default=None, max_length=50)
    fav_person: str | None = Field(default=None, max_length=80)
    first_name: str | None = Field(default=None, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)
    gender: str | None = Field(default=None, max_length=30)


class AuthRegisterResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    recovery_code: str  # shown ONCE — client must display and let user save it


class AuthLoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=6, max_length=128)
    remember_me: bool = False


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AuthVerifyIdentityRequest(BaseModel):
    """Step 1 of forgot-password: identify + answer any one security question."""
    identifier: str = Field(min_length=1, max_length=120)
    recovery_code: str | None = Field(default=None, max_length=30)
    fav_animal: str | None = Field(default=None, max_length=50)
    fav_person: str | None = Field(default=None, max_length=80)


class AuthVerifyIdentityResponse(BaseModel):
    identity_token: str | None = None  # set when identity is confirmed
    needs_questions: bool = False       # true when user has security questions to answer


class AuthResetPasswordRequest(BaseModel):
    """Uses identity_token issued by verify-identity."""
    token: str = Field(min_length=1, max_length=2048)
    new_password: str = Field(min_length=6, max_length=128)


class AuthChangePasswordRequest(BaseModel):
    """For logged-in users: verify via current password or any one security question."""
    current_password: str | None = Field(default=None, max_length=128)
    recovery_code: str | None = Field(default=None, max_length=30)
    fav_animal: str | None = Field(default=None, max_length=50)
    fav_person: str | None = Field(default=None, max_length=80)
    new_password: str = Field(min_length=6, max_length=128)


class AuthForgotPasswordRequest(BaseModel):
    email: EmailStr


class AuthForgotPasswordResponse(BaseModel):
    message: str
    reset_token: str | None = None


class AuthMessageResponse(BaseModel):
    message: str
