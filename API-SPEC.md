# DAIRA — Core API Routes & Middleware (v1.0)

Base: `https://api.daira.ma/api/v1`
Tenant resolution (middleware `resolveTenant`, in order):
1. Subdomain `{tenantCode}.daira.ma`, else
2. Header `X-Tenant-ID`, else
3. JWT claim `tenant_id` (member-scoped tokens).

Auth: `Authorization: Bearer <JWT>` (roles: `super_admin`, `manager`, `supervisor`, `member`).
All responses: `{ "data": …, "meta": { "tenant": "T001" } }`. Errors: `{ "error": { "code": "STOCK_INSUFFICIENT", "message": "…" } }`.

## Tenants (platform)
| Method & path | Role | Description |
|---|---|---|
| `POST /tenants` | super_admin | Provision workspace: creates tenant, owner user, default settings, sequence counters → `201 { tenant, adminUser }` |
| `GET /tenants` | super_admin | List tenants + member counts |
| `PATCH /tenants/:id` | manager | Branding, regional settings |

## Members & intake (Phase 1)
| Method & path | Role | Description |
|---|---|---|
| `GET /:tenant/members` | member+ | Member registry (paginated, `?status=active`) |
| `POST /:tenant/members` | manager | Create member → `MBR-###` |
| `POST /:tenant/intake` | supervisor+ | **Member Contribution Ledger**: `{memberId, materialId, qty, grade, moisture, acidity}` → creates `raw_batches` row with traceability `batch_code`, credits `member_ledger` |
| `GET /:tenant/batches/:code` | member+ | Batch traceability lookup |

## Transformation / BOM (Phase 2)
| Method & path | Role | Description |
|---|---|---|
| `GET /:tenant/recipes` | supervisor+ | List recipes with BOM |
| `POST /:tenant/recipes` | manager | Define recipe: inputs, outputs, `loss_pct`, checkpoints |
| `POST /:tenant/runs` | supervisor+ | **Transformation engine**: `{recipeId, allocations:[{rawBatchId, qty}]}` → validates stock atomically, applies `output = input × per_input_unit × (1 − loss)`, mints `finished_lots`, writes `inv_ledger` |
| `GET /:tenant/runs/:code` | supervisor+ | Run detail + checkpoints |

## Compliance & passport (Phase 3)
| Method & path | Role | Description |
|---|---|---|
| `GET /:tenant/certifications` | member+ | Vault (with `days_to_expiry`) |
| `POST /:tenant/certifications` | manager | Store certificate (multipart file → object storage) |
| `GET /:tenant/passport/:lotCode` | **public** | **Digital Product Passport**: members, dates, fair-price breakdown, certifications. Signed payload (`?sig=`) for offline verification |

## Inventory & sales (Phase 4)
| Method & path | Role | Description |
|---|---|---|
| `GET /:tenant/inventory` | supervisor+ | Real-time stock per lot (cached counter + ledger check) |
| `POST /:tenant/sales` | supervisor+ | **Concurrency-safe sale**: `{items, channel, payment, idempotencyKey}` → atomic reserve-and-decrement; `409 STOCK_INSUFFICIENT`; duplicate key returns original sale |
| `POST /:tenant/inventory/adjust` | manager | Manual adjustment (+reason, audited) |
| `GET /:tenant/sales` | supervisor+ | Sales history (`?channel=POS&synced=false` for offline queue) |
| `POST /:tenant/sales/:id/sync-ack` | supervisor+ | Field POS confirms server sync |

## Governance & dividends (Phase 5)
| Method & path | Role | Description |
|---|---|---|
| `POST /:tenant/assemblies` | manager | Create AG/AGE/CA + PV (`pv_ref` auto) |
| `GET /:tenant/assemblies` | member+ | Legal register |
| `POST /:tenant/votes` | manager | Open voting session |
| `POST /:tenant/votes/:id/cast` | manager | Cast vote `{choice: yes|no|abstain}` (one increment, audited) |
| `POST /:tenant/votes/:id/close` | manager | Close session |
| `POST /:tenant/dividends` | manager | **Patronage engine**: `{season, surplus}` → pro-rata allocations (idempotent per season) |
| `POST /:tenant/dividends/:id/confirm` | manager | Confirm → appends `DIVIDEND` credits to `member_ledger` |

## Middleware pipeline (per request)
`requestId → rateLimit → authenticate(JWT) → resolveTenant → authorize(RBAC) → tenantScope(RLS SET app.tenant_id) → validate → handler → auditLog`

## RBAC matrix (summary)
| Capability | super_admin | manager | supervisor | member |
|---|---|---|---|---|
| tenant.provision | ✅ | | | |
| intake.create | ✅ | ✅ | ✅ | |
| production.run | ✅ | ✅ | ✅ | |
| sale.create | ✅ | ✅ | ✅ | |
| inventory.adjust / cert.manage / assembly.manage / dividend.run | ✅ | ✅ | | |
| read (own tenant) | ✅ | ✅ | ✅ | ✅ |
