<!--
SYNC IMPACT REPORT
==================
Version change: TEMPLATE → 1.0.0 (initial ratification)
Bump rationale: First ratified constitution derived from the placeholder template.
                MAJOR=1 establishes the baseline governance contract.

Modified principles (placeholder → final):
- [PRINCIPLE_1_NAME]   → I.   Clean, Modular, Type-Safe Code
- [PRINCIPLE_2_NAME]   → II.  Trusted Libraries & Fixed Stack
- [PRINCIPLE_3_NAME]   → III. Modern Minimalist UI/UX, No Emojis
- [PRINCIPLE_4_NAME]   → IV.  Centralized Observability (NON-NEGOTIABLE)
- [PRINCIPLE_5_NAME]   → V.   Documented Code, Minimal Testing Discipline

Added sections:
- Technology Stack & Constraints (replaces [SECTION_2_NAME])
- Development Workflow & Quality Gates (replaces [SECTION_3_NAME])

Removed sections: None.

Templates requiring updates:
- .specify/templates/plan-template.md ........ ✅ compatible (generic "Constitution Check"
  gate; Technical Context fields accept the stack mandated by Principle II)
- .specify/templates/spec-template.md ........ ✅ compatible (no principle-driven section
  changes needed; spec stays implementation-agnostic by design)
- .specify/templates/tasks-template.md ....... ✅ compatible (Foundational phase already
  reserves slots for logging and error handling, matching Principle IV)
- .specify/templates/checklist-template.md ... ✅ compatible
- .specify/templates/commands/*.md ........... ⚠ not present in this project (skip)
- README.md / docs/quickstart.md ............. ⚠ not present in this project (skip)

Deferred / TODO items: None. All placeholders resolved.
-->

# sp_graph Constitution

## Core Principles

### I. Clean, Modular, Type-Safe Code

All first-party code MUST be statically typed: TypeScript on every Node/browser surface
(no untyped `.js`), and Python with type hints on every public function and dataclass.
Modules MUST follow single-responsibility: one concern per file, explicit named exports,
no circular dependencies, no dead code shipped to `main`. Cross-cutting concerns
(logging, configuration, persistence) MUST live behind dedicated modules so feature code
imports them rather than re-implementing them.

**Rationale**: Types catch interface drift before runtime; modular boundaries keep the
project navigable as it grows past a single feature.

### II. Trusted Libraries & Fixed Stack

Dependencies MUST be popular, actively maintained, and well-documented. The canonical
stack is non-negotiable for new work:

- **Frontend / Node**: TypeScript, `pnpm` as the only package manager, Tailwind CSS for
  styling. Framework choice (e.g., React, Vue, Svelte) is per-feature but MUST be a
  mainstream, currently-maintained option.
- **Backend (when required)**: FastAPI (Python) with SQLite as the default datastore.
  An ORM is permitted only if it is a well-known choice (e.g., SQLAlchemy / SQLModel).

Introducing a dependency outside this profile — or swapping the package manager,
styling solution, web framework, or database engine — requires a written justification
in the relevant `plan.md` under "Complexity Tracking" and explicit constitution-level
approval.

**Rationale**: A narrow, well-known stack keeps onboarding cheap, reduces supply-chain
risk, and prevents per-feature reinvention of infrastructure choices.

### III. Modern Minimalist UI/UX, No Emojis

User interfaces MUST follow a modern, minimalist visual language: generous whitespace,
limited type scale, restrained palette, accessible contrast. Tailwind utility classes
are the default styling mechanism; custom CSS is allowed only when Tailwind cannot
express the requirement. Emojis MUST NOT appear in source code, UI strings, log
output, commit messages, or generated documentation. Iconography, when required, MUST
come from a single icon library (e.g., Lucide, Heroicons) rather than ad-hoc glyphs.

**Rationale**: A consistent minimalist baseline is faster to build, easier to keep
accessible, and signals a professional tone. The emoji ban removes a recurring source
of locale, font, and accessibility inconsistencies.

### IV. Centralized Observability (NON-NEGOTIABLE)

Every runtime component MUST emit diagnostics through a single, centralized logger
module — one for the TypeScript side and one for the Python side, both implementing the
same contract. Direct calls to `console.log` / `print` are prohibited in committed code
outside the logger module itself.

The logger MUST:

1. Prefix every record with a severity tag drawn from `[DEBUG]`, `[INFO]`, `[WARNING]`,
   `[ERROR]`, `[CRITICAL]`.
2. Color the prefix in terminal output using ANSI colors with a conventional mapping
   (e.g., `INFO`=cyan/blue, `WARNING`=yellow, `ERROR`=red, `CRITICAL`=bright red /
   bold, `DEBUG`=gray). Color MUST auto-disable when stdout is not a TTY or when
   `NO_COLOR` is set.
3. Write every record simultaneously to the terminal AND to a rotating log file under
   a `logs/` directory at the repository or app root.
4. Include a UTC ISO-8601 timestamp and the originating module/logger name in every
   record.

**Rationale**: A single, predictable logging surface is the cheapest tool for
diagnosing "why didn't this work?" — the explicit driver behind this principle.

### V. Documented Code, Minimal Testing Discipline

Public APIs MUST be documented in the idiomatic style of their language: TSDoc/JSDoc
blocks on exported TypeScript symbols (`@param`, `@returns`, `@throws`); Google- or
NumPy-style docstrings on Python modules, classes, and public functions. Internal
helpers SHOULD carry at least a one-line summary when their intent is non-obvious.
README and quickstart material MUST stay in sync with shipped behavior.

Automated tests are NOT a coverage target. Tests SHOULD be written only for: (a)
genuinely critical paths whose silent failure would corrupt data or mislead users, and
(b) interface contracts that other modules depend on. Manual verification through the
running app is an acceptable validation strategy elsewhere. Test code, when written,
MUST obey every other principle of this constitution.

**Rationale**: Documentation is the durable artifact future contributors actually
read; tests have a cost, and the project's stage does not justify a coverage mandate.

## Technology Stack & Constraints

- **Languages**: TypeScript (frontend / Node tooling), Python 3.11+ (backend, scripts).
- **Frontend package manager**: `pnpm` — `npm` and `yarn` lockfiles MUST NOT be
  committed.
- **Styling**: Tailwind CSS; design tokens centralized in the Tailwind config.
- **Backend framework**: FastAPI with Pydantic models for request/response schemas.
- **Database**: SQLite by default; a different engine requires constitutional approval
  per Principle II.
- **Logging directory**: `logs/` at the repo or app root, ignored by VCS except for a
  retained `.gitkeep`.
- **No emojis**: applies to source, UI, logs, documentation, and commit messages.
- **No untyped JavaScript / no `any`-by-default**: TS `strict` mode MUST be on.
- **Repository hygiene**: lockfiles (`pnpm-lock.yaml`, `uv.lock` or `requirements.txt`)
  MUST be committed.

## Development Workflow & Quality Gates

1. **Spec Kit flow**: Features advance through `/speckit-specify` →
   `/speckit-clarify` (when needed) → `/speckit-plan` → `/speckit-tasks` →
   `/speckit-implement`. Each phase MUST treat this constitution as the source of
   truth for stack, style, and observability decisions.
2. **Constitution Check gate** (in `plan.md`): every plan MUST enumerate, per
   principle, whether the proposed design complies. Violations MUST land in
   "Complexity Tracking" with a written justification before implementation tasks are
   generated.
3. **Foundational tasks**: every feature's task list MUST include, before any user
   story work, a task that wires the centralized logger and any required configuration
   loader. Missing this task is a constitution violation.
4. **Code review checklist** (recommended per PR): types are strict, no
   `console.log`/`print`, no emojis, no rogue dependencies, public symbols documented,
   logger used for all diagnostic output.
5. **Documentation sync**: when behavior changes, the corresponding docstrings, README
   sections, and quickstart steps MUST be updated in the same change.

## Governance

This constitution supersedes any ad-hoc convention found elsewhere in the repository.

**Amendment procedure**: Amendments are proposed by editing this file (typically via
`/speckit-constitution`), generating an updated Sync Impact Report, propagating changes
to dependent templates, and committing the result. The committer MUST briefly justify
the version bump in the commit message.

**Versioning policy** (semantic):

- **MAJOR**: Removing a principle, redefining one incompatibly, or changing governance
  rules in a way that invalidates prior plans.
- **MINOR**: Adding a new principle or materially expanding the guidance of an existing
  one or a section.
- **PATCH**: Clarifications, wording, typo fixes, and non-semantic refinements.

**Compliance review**: Every `/speckit-plan` execution MUST run the Constitution Check
gate. Every `/speckit-analyze` execution SHOULD surface drift between artifacts and
this constitution. Persistent violations block `/speckit-implement` until resolved or
justified in writing.

**Runtime guidance**: Project-level runtime guidance lives in `CLAUDE.md` at the
repository root; agent-specific guidance files (if introduced later) MUST defer to
this constitution on any conflict.

**Version**: 1.0.0 | **Ratified**: 2026-05-28 | **Last Amended**: 2026-05-28
