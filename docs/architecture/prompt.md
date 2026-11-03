# Claude Code Prompt — Apply the Village Builder Target Architecture

*External proposal, not design. Written by ChatGPT in a review session with Kim and passed on on 3 November 2026; the second of three
documents (with `target-architecture.md` and `stress-tests.md`). The text is as received; only Markdown markup was added and apostrophes
straightened. Kim's instruction of 3 November was to analyse it, not to run it: what the project took from it, and in which order, is in
`docs/review-architecture.md`; the assessment it asks for is backlog task VB-172.*

---

You are working in the existing Village Builder repository.

Your task is to evolve the existing codebase towards the target architecture described below and in the accompanying architecture specification.

This is an architectural refactoring and implementation task, not an invitation to rewrite the game from scratch.

The most important requirements are:

* Understand the existing implementation before changing it.
* Establish clear state ownership and well-defined subsystem interfaces.
* Preserve existing gameplay and working functionality.
* Make architectural improvements incrementally.
* Avoid introducing unnecessary abstractions or systems.
* Demonstrate that the architecture supports the intended future gameplay.

## 1. First: inspect the actual codebase

Before proposing changes, inspect:

* The repository structure.
* The simulation entry points and lifecycle.
* The simulation manifest and module loading.
* Existing systems and their dependencies.
* State ownership and mutation patterns.
* Commands, events and simulation scheduling.
* Pawn, household, settlement and world models.
* Jobs, activities, production and resource handling.
* Land, ownership, claims and territory.
* Relationships, lifecycle and social interactions.
* Rendering and UI dependencies.
* Tests and deterministic simulation facilities.
* Save/load and persistence, if present.
* Existing architecture documentation and backlog.

Do not assume that the architecture described in this prompt already exists.

Use the implementation as the source of truth. When a concept exists only partially, identify that explicitly.

Do not infer architectural quality from file names or directory structure.

## 2. Produce an architecture assessment before editing

Create an initial assessment containing:

### A. Existing subsystem inventory

For every meaningful existing subsystem, document:

* Its purpose.
* The state it owns.
* Its important invariants.
* Its public interface.
* Its dependencies.
* Its consumers.
* Its main reasons to change.

### B. State ownership map

Identify every important category of authoritative state and its current owner.

Pay particular attention to:

* Pawn identity and lifecycle.
* Household membership and plans.
* Settlement identity and shared affairs.
* Land and land rights.
* Resources and inventories.
* Production state.
* Jobs and activities.
* Relationships and social status.
* Institutions and obligations.
* Market and trade state.
* Player-controlled pawn and player input.

Identify cases where multiple systems can mutate the same state.

### C. Dependency map

Show the important subsystem dependencies and identify:

* Circular dependencies.
* Direct cross-system state access.
* Excessively broad interfaces.
* Systems that know too much about other domains.
* Systems that combine unrelated responsibilities.
* Systems that are merely procedural groupings rather than genuine ownership boundaries.

### D. Workflow analysis

Trace representative workflows through the actual code.

At minimum:

* A pawn undertaking work.
* A household planning a construction project.
* A resource being produced and consumed.
* A pawn joining or leaving a household.
* A land ownership or claim change.
* A social interaction.
* A transaction, if one exists.

Show which subsystem owns each state transition.

### E. Architecture gap analysis

Compare the current implementation with the target architecture.

Classify each finding:

* Already well represented.
* Present but with unclear ownership.
* Present but tightly coupled.
* Missing but needed soon.
* Future concept that should not yet be implemented.

Do not create new systems merely because a concept appears in the target architecture.

## 3. Target architectural model

Use three complementary architectural categories.

### Domain models

Own authoritative world state and domain invariants.

The conceptual domains are:

1. Society
    * People, identity, lifecycle, health, kinship, relationships, reputation, skills and knowledge.
2. Households
    * Membership, domestic organisation, needs, goals, plans and commitments.
3. Settlements
    * Community identity, collective affairs and settlement-level development.
4. Land
    * Land identity, ownership, tenure, claims, access and land-use rights.
5. Ecology
    * Soil, vegetation, natural resources and ecological processes.
6. Production
    * Farming, husbandry, gathering, crafting, construction and other productive processes.
7. Resources
    * Goods, inventories, ownership, storage, transfers, reservations and consumption.
8. Institutions and Governance
    * Organisations, membership, roles, authority, rules, obligations, taxes, justice and enforcement.
9. Exchange and Enterprise
    * Markets, offers, transactions, prices, businesses, contracts, credit and trade.
10. Regional and External World
    * Abstract distant settlements, external conditions, visitors, ships, migration, news and regional trade.

These are conceptual boundaries, not mandatory module names or an instruction to create ten independent systems immediately.

### Cross-domain processes

Coordinate changes across domain models.

Examples:

* Agency and decision-making.
* Household and individual planning.
* Work opportunity discovery and activity coordination.
* Social interaction.
* Construction and other multi-domain workflows.
* Tax collection and obligation settlement.
* Trade negotiation and transaction completion.
* Apprenticeship and institutional workflows.

### Infrastructure

Provides technical capabilities:

* World geometry and spatial queries.
* Movement.
* Simulation time and scheduling.
* Deterministic randomness.
* Command and event processing.
* Persistence.
* Presentation.

### Player experience

Provides:

* Pawn embodiment and perspective.
* Player input and control.
* Personal goals and challenge presentation.
* Observation and feedback.

Player control must enter the same underlying agency and domain interfaces used by autonomous pawns. It must not bypass simulation rules.

## 4. Critical architectural distinctions

Ensure the design preserves these distinctions.

### Ownership versus coordination

A process coordinating several domains must not become the owner of their state.

### Opportunity versus plan versus activity versus execution

* Opportunity: something that could be done.
* Goal: a desired outcome.
* Plan: an intention or proposed way to reach an outcome.
* Activity: a concrete action being undertaken.
* Execution: the domain-specific process that changes the world.

### Land rights versus resource ownership versus authority

These are distinct concepts.

### Individual versus household versus settlement versus institution

A pawn may participate in all of these independently.

Do not assume that membership in one implies membership in another.

### Physical venue versus organisation versus social interaction

A tavern is a venue and may be operated by a business. Social interaction happens there but is not owned by the tavern implementation.

### Business versus profession

A baker is a skilled person or occupation. A bakery is a business. They are not interchangeable.

### Religious belief versus religious institution

An individual can hold religious beliefs without being a member of a particular church. A church can own property and organise religious life without owning individual beliefs.

## 5. Interfaces and state ownership

For every meaningful subsystem boundary, define an explicit interface.

Document:

* Queries.
* Commands or domain operations.
* Preconditions.
* Invariants.
* Results and failure conditions.
* Events or notifications.
* Ownership of returned data.
* Mutation authority.

Prefer narrow domain-specific interfaces over a universal world API.

Do not expose mutable internal collections.

Do not let consumers modify another subsystem's internal state directly.

If the existing implementation uses shared mutable state, do not immediately replace everything. Establish a migration strategy that introduces controlled access and gradually moves mutation authority to the correct owner.

Be precise about which operations are synchronous and which are scheduled or asynchronous within the simulation.

## 6. Work, planning and agency redesign

Pay particular attention to the existing jobs system.

The architecture must support the following model:

1. Domains expose opportunities to do work.
2. Households establish goals, plans and priorities.
3. Individual pawns consider household expectations alongside their own needs, preferences, skills, obligations and intentions.
4. Activity coordination matches willing and capable pawns to activities.
5. Domain-specific logic executes the work.
6. Progress and outcomes update plans and world state.

A household head may plan future construction and prioritise chores. This should not require the household head to directly assign every action to every pawn.

The architecture must support:

* Multiple competing plans.
* Resource and labour constraints.
* Reservations and commitments.
* Dependencies between activities.
* Interruptions.
* Opportunity invalidation.
* Failed or abandoned plans.
* Replanning.
* Individual initiative.
* Household expectations.
* Institutional obligations.
* Deterministic decisions.

Demonstrate how a household plans a barn while its members continue to manage agricultural work and personal needs.

Do not let a generic job system own construction, farming, harvesting or crafting rules.

## 7. Support the broader society

The architecture must be capable of accommodating the following without a fundamental redesign.

### Social mobility and pawn embodiment

A player can inhabit a pawn and pursue a life:

* Learn a trade.
* Become an apprentice.
* Establish a business.
* Acquire land.
* Join an institution.
* Escape dependency.
* Accumulate wealth or status.
* Pursue personal challenges.

### Institutions and hierarchy

Support churches, guilds, estates, councils, schools, merchant associations and other organisations.

Support membership, roles, authority, property, obligations, taxes and enforcement.

Do not implement a social class as a rigid pawn subtype. Social position should emerge from status, rights, wealth, relationships, institutional roles and authority.

### Markets and exchange

Support independent buyers and sellers, offers, prices, transactions, ownership transfers and regional trade.

### Cities and specialised businesses

Support businesses such as bakeries, smithies, workshops and inns.

Support employment, apprenticeships, skills, tools, workplaces, productive assets and commercial relationships.

### Social venues

Support marketplaces, taverns, alehouses, inns, churches, guildhalls, workshops, harbours and periodic fairs.

Venues should create opportunities for encounters beyond normal household and settlement networks.

### Regional and external world

Support merchant boats, travelling merchants, occasional elites, pilgrims, migrants, news and distant economic conditions.

Distant people and settlements may be represented abstractly until they enter the local simulation.

## 8. Implementation strategy

Work in deliberate stages.

### Stage 1: Architecture documentation

Create or update architecture documentation:

* System inventory.
* State ownership map.
* Dependency map.
* Interface catalogue.
* Important workflow diagrams.
* Current-to-target migration plan.
* Explicit list of unresolved design decisions.

### Stage 2: Identify the highest-value boundaries

Prioritise boundaries that:

* Have ambiguous state ownership.
* Cause widespread coupling.
* Prevent deterministic testing.
* Make common gameplay changes difficult.
* Require multiple systems to mutate the same data.

Do not refactor merely to make the architecture diagram look cleaner.

### Stage 3: Establish interfaces

Introduce or strengthen interfaces around the most important ownership boundaries.

Keep adapters or compatibility layers where they reduce migration risk.

### Stage 4: Migrate representative workflows

Choose a small number of end-to-end workflows and move them to the new interfaces.

Run tests after each migration.

### Stage 5: Consolidate and document

Remove obsolete access paths only when their consumers have migrated.

Update documentation to reflect the implementation, not the original intention.

### Stage 6: Future extensibility review

Evaluate whether the architecture can support the scenarios in the accompanying architectural test document.

Do not implement all future features just to prove that they can exist.

## 9. Required engineering constraints

Preserve the existing technology stack and build process unless inspection establishes a compelling reason to change them.

Do not:

* Introduce a new framework without justification.
* Rewrite the simulation kernel without a concrete need.
* Create an elaborate event bus as a substitute for explicit interfaces.
* Create a universal entity or service layer that owns everything.
* Create generic abstractions with only one speculative use.
* Split every profession, building or social group into a separate system.
* Move all simulation logic into a central manager.
* Let presentation code mutate simulation state.
* Sacrifice deterministic behaviour.
* Change gameplay semantics silently.

Prefer plain, understandable code and explicit contracts.

## 10. Required deliverables

Produce:

1. Architecture assessment.
2. State ownership map.
3. Dependency graph.
4. Interface catalogue.
5. Workflow diagrams.
6. Migration plan.
7. Implemented changes in small, reviewable increments.
8. Tests for migrated interfaces and workflows.
9. Updated architecture documentation.
10. Final report explaining:
    * What changed.
    * What remains unchanged.
    * What architectural problems were resolved.
    * What known limitations remain.
    * What future concepts are supported but not implemented.
    * Which design decisions still need human input.

## 11. Working style

Be critical.

If the target architecture conflicts with the actual codebase, explain the conflict and recommend an appropriate adjustment.

If a proposed boundary is not justified by state ownership, invariants, independent reasons to change or testability, do not force it into the code.

If two concepts can share an implementation without coupling their ownership or invariants, allow that.

Prefer the smallest architectural change that produces a meaningful improvement.

Do not claim a subsystem is independent merely because it has its own file.

Do not claim the architecture supports a scenario unless its state ownership, interfaces and workflow have actually been demonstrated.

The desired result is a coherent, understandable simulation architecture that can grow from a household-scale agricultural simulation into a living regional society in which the player can inhabit an individual pawn and pursue an open-ended life.
