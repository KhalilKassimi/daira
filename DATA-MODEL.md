# DAIRA — Multi-Tenant Entity-Relationship Data Model (v1.0)

> Every table carries `tenant_id`. In production (PostgreSQL) isolation is enforced with
> Row-Level Security policies: `USING (tenant_id = current_setting('app.tenant_id'))`.
> The static demo (`domain.js` + namespaced `localStorage`) implements the same rule in the
> `scoped()` / `get()` / `put()` guard layer.

## Entities

### Platform / tenancy
| Table | Key fields |
|---|---|
| `tenants` | `id` PK · `code` (e.g. `T001`) · `name`, `name_ar` · `region`, `sector` · `branding{primary, logo_emoji}` · `settings{locale, currency, timezone}` · `plan` · `status` |
| `users` | `id` PK · `tenant_id` FK (`*` = platform scope) · `name`, `phone` · `role` ∈ {`super_admin`,`manager`,`supervisor`,`member`} · `is_owner` |

### Phase 1 — Upstream: members & intake
| Table | Key fields |
|---|---|
| `members` | `id` PK · `tenant_id` FK · `code` (`MBR-001`) · `name`, `name_ar` · `village`, `plot_ref` · `status` |
| `materials` | `id` PK · `tenant_id` FK · `name`, `name_ar` · `unit` · `base_price` (MAD) · `grades[]` |
| `raw_batches` | `id` PK · `tenant_id` FK · `member_id` FK · `material_id` FK · `batch_code` (`T001-MP-2026-0001`) · `qty`, `unit` · `grade` ∈ {A,B,C} · `quality{moisture, acidity}` · `unit_price`, `total_credit` · `qty_remaining` · `status` ∈ {available, partial, consumed} · `received_at`, `received_by` |
| `member_ledger` *(append-only)* | `id` PK · `tenant_id` FK · `member_id` FK · `kind` ∈ {CREDIT, PAYOUT, DIVIDEND} · `amount` · `ref`, `ref_id` · `label` |

### Phase 2 — Transformation (BOM)
| Table | Key fields |
|---|---|
| `recipes` | `id` PK · `tenant_id` FK · `name` · `inputs[{material_id, qty_per_unit}]` · `outputs[{product_id, per_input_unit}]` · `loss_pct` · `labor_cost` · `checkpoints[]` |
| `products` | `id` PK · `tenant_id` FK · `name`, `name_ar` · `sku` · `unit` · `sale_price` · `components[]` (packaging BOM: bottles, caps, labels, seals) |
| `runs` | `id` PK · `tenant_id` FK · `recipe_id` FK · `run_code` (`T001-PR-2026-0001`) · `inputs[{raw_batch_id, qty}]` · `total_input_qty` · `loss_pct` · `outputs[{lot_id, qty}]` · `status` |
| `finished_lots` | `id` PK · `tenant_id` FK · `product_id` FK · `run_id` FK · `lot_code` (`T001-LOT-2026-0001`) · `qty_produced`, `qty_available` · `source_batches[]`, `source_members[]` · `status` |

### Phase 3 — Compliance
| Table | Key fields |
|---|---|
| `certifications` | `id` PK · `tenant_id` FK · `type` ∈ {ONSSA, AOP, IGP, BIO, FAIR} · `ref_number` · `label` · `issued_at`, `expires_at` · `status` · `file_ref` |

### Phase 4 — Inventory & sales
| Table | Key fields |
|---|---|
| `inv_ledger` *(append-only)* | `id` PK · `tenant_id` FK · `lot_id` FK · `change` (±) · `reason` ∈ {production, sale, adjustment} · `ref`, `ref_id` · `actor` |
| `sales` | `id` PK · `tenant_id` FK · `sale_code` (`T001-V-2026-0001`) · `channel` ∈ {POS, ONLINE, FAIR} · `payment` ∈ {CASH, COD, TRANSFER} · `items[{lot_id, qty, unit_price, line_total}]` · `total` · `status` ∈ {paid, pending_delivery} · `idempotency_key` · `synced` |

### Phase 5 — Governance & dividends
| Table | Key fields |
|---|---|
| `assemblies` | `id` PK · `tenant_id` FK · `type` ∈ {AG, AGE, CA} · `title` · `held_at` · `attendees[]` · `decisions[]` · `pv_ref` · `status` ∈ {draft, signed} |
| `votes` | `id` PK · `tenant_id` FK · `assembly_id` FK · `question`, `question_ar` · `results{yes, no, abstain}` · `status` ∈ {open, closed} |
| `dividend_campaigns` | `id` PK · `tenant_id` FK · `season` · `surplus` · `total_points` · `allocations[{member_id, points, share_pct, amount}]` · `status` ∈ {calculated, confirmed} |

## Relationships (summary)

```
tenants 1───* users / members / materials / recipes / products / certifications / sales / assemblies / votes / dividend_campaigns
members 1───* raw_batches ───* runs.inputs ───* runs ───* finished_lots ───* sales.items
members 1───* member_ledger
recipes *───* materials (inputs) · recipes *───* products (outputs)
finished_lots 1───* inv_ledger
assemblies 1───* votes
```

## Concurrency & integrity notes
- **Inventory** is never updated in place by business code: `qty_available` is a cached counter, the `inv_ledger` append-only log is the source of truth; negative stock is rejected before commit.
- **Sales** carry an `idempotency_key` → safe retries on flaky field connections (offline-first POS).
- **Dividends**: `points(member) = Σ qty × qualityFactor(grade) × priceFactor(grade)`; `amount = surplus × points / Σpoints`. A season can only be calculated once; confirmation appends `DIVIDEND` entries to `member_ledger`.
