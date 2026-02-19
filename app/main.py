from fastapi import FastAPI
from app.core.database import engine, Base
from app.api import unit_routes, geography_routes, infra_app_routes, application_routes, user_routes, escalation_routes, auth_routes, audit_routes
from app.models import audit_log
from fastapi.middleware.cors import CORSMiddleware

# import all models so SQLAlchemy registers them
from app.models import user, unit, geography, infra_app, application, escalation_config, escalation_level

app = FastAPI(title="Escalation Matrix API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(unit_routes.router, prefix="/units", tags=["Units"])
app.include_router(geography_routes.router, prefix="/geographies", tags=["Geographies"])
app.include_router(infra_app_routes.router, prefix="/infra-apps", tags=["InfraApps"])
app.include_router(application_routes.router, prefix="/applications", tags=["Applications"])
app.include_router(user_routes.router, prefix="/users", tags=["Users"])
app.include_router(escalation_routes.router, prefix="/escalations", tags=["Escalations"])
app.include_router(auth_routes.router, prefix="/auth", tags=["Auth"])
app.include_router(audit_routes.router, prefix="/audit-logs", tags=["Audit Logs"])

@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)

@app.get("/")
def health():
    return {"status": "API running"}
