app/
├── (auth)/
│   ├── layout.tsx
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
│
└── (dashboard)/
    ├── layout.tsx
    ├── page.tsx
    ├── documents/
    └── chat/


# When not logged in, the user sees:
```
┌─────────────────────────────┐
│                             │
│        ┌─────────────┐      │
│        │   LOGIN     │      │
│        │             │      │
│        │ Email       │      │
│        │ Password    │      │
│        │             │      │
│        │   Log In    │      │
│        │             │      │
│        │ Don't have  │      │
│        │ an account? │      │
│        │ Register    │      │
│        └─────────────┘      │
│                             │
└─────────────────────────────┘
```

# When logged in
Once the user logs in, they enter your dashboard:
```
┌──────────────┬──────────────────────────┐
│              │                          │
│ Dashboard    │                          │
│ Documents    │       Main Content       │
│ Chat         │                          │
│              │                          │
│              │                          │
│ ───────────  │                          │
│ 👤 Account   │                          │
│ 🚪 Logout    │                          │
└──────────────┴──────────────────────────┘
```
(dashboard)/layout.tsx contains the persistent:
- Sidebar
- Navbar
- Logout button
- User/account
- No need for Login/Register buttons since person is already authenticated if they were able to see this page

# When logging out

If user is currently on /dashboard and click Logout, our frontend calls:
```
await logout()
```
FastAPI clears the httpOnly cookie. If it clears and responds successfully, then we know the logout()
resolved correctly. Then our Next.js code explicitly redirects the user to /login. The backend clearing the cookie does not automatically redirect the browser. The frontend routes the pages.
```
router.push("/login) - which is the file page.tsx inside app/(auth) so they see the same login screen again
```

# Overall Flow:

```
                   User visits app
                         │
                         ↓
                   Is authenticated?
                    /           \
                  YES             NO
                   │               │
                   ↓               ↓
              Dashboard          Login
                   │               │
             ┌─────┴─────┐        │
             │           │        │
          Sidebar      Navbar     │
             │           │        │
          Logout         │        │
             │           │        ↓
             │           │      Register
             │           │        │
             │           │        ↓
             │           │       Login
             │           │
             ↓           │
          Logout ────────┘
                ↓
              Login
```