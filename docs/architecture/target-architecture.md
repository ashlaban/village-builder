# Village Builder — Target Architecture

*External proposal, not design. Written by ChatGPT in a review session with Kim and passed on on 3 November 2026; the first of three documents
(with `prompt.md` and `stress-tests.md`). The text is as received; only Markdown markup was added and apostrophes straightened. What the project took
from it, and what not, is in `docs/review-architecture.md`; the game's design is `design.md`.*

---

## 1. Vision

Village Builder is a living society simulation in which individual pawns, households, settlements, institutions and regional economies interact and evolve over time.

The simulation should be interesting at multiple scales:

* An individual pawn living a life, developing relationships, learning skills and pursuing ambitions.
* A household managing its needs, resources, work and future.
* A settlement developing its economy, infrastructure, institutions and identity.
* A regional society connecting settlements through trade, migration, religion, politics and culture.
* A wider world that periodically interacts with the local simulation through visitors, merchants, ships, news and political events.

The player can inhabit an individual pawn and participate directly in this world. They can pursue an ordinary life, escape poverty or dependence, climb the social ladder, build a business, join an institution, acquire land, or pursue self-imposed challenges.

The simulation must remain interesting without player intervention. Pawns and organisations have their own needs, intentions, plans and agency. The player participates in the simulation rather than replacing it.

The central architectural objective is:

> Represent a society through independently owned domain models, connected by explicit interfaces and coordinated by processes that do not take ownership of the domains they coordinate.

The architecture should support emergent behaviour without requiring every possible profession, social class, institution, ambition or interaction to be hard-coded.

---

## 2. Architectural model

The architecture has three complementary parts.

### 2.1 Domain models — ownership of truth

Domain models own the authoritative state and rules for a particular part of the world.

Examples:

* Society owns personal identity and social relationships.
* Households own domestic organisation and household plans.
* Land owns land rights and land-use relationships.
* Resources own goods, inventories and resource transfers.
* Institutions own organisational membership, roles and rules.
* Exchange owns market offers and transactions.

A domain should own the facts and invariants that make sense within its subject.

### 2.2 Cross-domain processes — coordination of change

Processes coordinate work involving multiple domain models.

Examples:

* A household decides to build a barn.
* A lord establishes a tax obligation.
* A merchant arranges a transaction.
* A pawn travels to another settlement and forms a relationship.
* A church organises a festival.
* A household arranges an apprenticeship.

A coordinating process may query and invoke multiple domains, but must not silently become the owner of their state.

### 2.3 Infrastructure — capabilities shared by the simulation

Infrastructure provides technical capabilities without owning the game's domain rules.

Examples:

* Simulation time and scheduling.
* Deterministic random number generation.
* Spatial queries and movement.
* Command processing.
* Event recording.
* Persistence.
* Presentation and rendering.

These three parts are not a strict hierarchy. Domains collaborate through explicit contracts.

---

## 3. Domain models and responsibilities

The following are conceptual boundaries. They do not mandate one source file or one runtime system per heading. Related concepts may share an implementation where that is appropriate.

### 3.1 Society

Purpose: Represent individual people and their social existence.

Owns:

* Pawn identity and persistent personal attributes.
* Life stages and lifecycle.
* Health, injury, ageing and other personal conditions.
* Kinship and genealogy.
* Personal relationships.
* Social status, reputation and identity.
* Skills, knowledge and experience.
* Personal beliefs and affiliations where appropriate.

Does not own:

* Household membership as a household's authoritative membership record.
* Employment contracts as an institution's or business's authoritative records.
* Land or resource ownership.
* Household or institutional plans.

Society should support relationships across household, settlement, occupational, institutional and geographical boundaries.

A pawn must remain the same person when moving between households, settlements, occupations or social positions.

### 3.2 Households

Purpose: Represent domestic organisation and the economic and social unit through which people commonly organise their lives.

Owns:

* Household identity and membership relationships.
* Domestic organisation and responsibilities.
* Household needs and priorities.
* Household goals and plans.
* Household resource commitments where applicable.
* Domestic decision-making and planning.
* Household formation, division and dissolution rules.

Households are not equivalent to families. Membership and kinship are related but distinct.

Households may have heads or other leadership arrangements, but the model must not require every household to have a household head.

A household may plan work, construction, resource acquisition or other activities. It expresses intentions and priorities; it does not directly execute all the work itself.

### 3.3 Settlements

Purpose: Represent geographically situated communities.

Owns:

* Settlement identity and history.
* Settlement-level membership and civic relationships.
* Shared affairs and collective priorities.
* Settlement-level development and planning.
* Local community institutions and shared arrangements where appropriate.

A settlement may be a village, town or city.

Settlement size and complexity may vary. A city can contain specialised districts, businesses, guilds and institutions without requiring a separate fundamental model of person or household.

Settlements are not simply collections of households. They have collective identity, interests and institutions.

### 3.4 Land and spatial rights

Purpose: Represent land, its use and the rights people and organisations hold over it.

Owns:

* Parcels or other land units.
* Land ownership and control.
* Tenure, leases, claims and access rights.
* Land-use permissions and restrictions.
* Development rights.
* Relevant land-related obligations.

Distinguish:

* Physical land.
* Legal or customary rights over land.
* Buildings and infrastructure situated on land.
* Resources produced on land.

Ownership, occupation, access and use are not interchangeable.

A household can work land it does not own. An institution can own land in another settlement. A lord can hold rights over land while another party cultivates it.

### 3.5 Ecology

Purpose: Represent natural systems and environmental change.

Owns:

* Soil conditions.
* Vegetation and natural resources.
* Forests and natural regeneration.
* Ecological processes.
* Environmental conditions relevant to production and settlement.

Ecology should expose relevant capabilities and information to production and land-use systems without becoming the owner of all activity occurring on land.

### 3.6 Production

Purpose: Represent productive processes that transform inputs into outputs.

Owns:

* Production methods and recipes.
* Crop cultivation and agricultural cycles.
* Animal husbandry and productive animal processes.
* Craft production.
* Gathering and other productive activities.
* Yields, requirements and production constraints.
* Production opportunities and progress where domain-specific.

Production is not the owner of the resulting goods or their ownership.

A farm produces grain. Resources represents the grain after it has been produced.

Production should be extensible to occupations and specialisations such as:

* Farming.
* Baking.
* Smithing.
* Carpentry.
* Construction.
* Milling.
* Fishing.
* Other crafts and services.

Do not create a top-level system for each profession. Professions should emerge from skills, capabilities, production methods, assets, organisations and economic relationships.

### 3.7 Resources

Purpose: Represent goods and other transferable resources.

Owns:

* Resource identities and quantities.
* Inventories and storage.
* Resource ownership and control.
* Transfers between owners or locations.
* Consumption and destruction.
* Resource reservations and commitments where appropriate.
* Resource availability.

Distinguish:

* Existing resources.
* Available resources.
* Reserved resources.
* Committed resources.
* Consumed resources.

A plan must not assume that a resource is available merely because it exists somewhere in the world.

Resources should support ownership by pawns, households, businesses and institutions.

### 3.8 Institutions and governance

Purpose: Represent organised social structures, collective authority and rules.

Institutions own or coordinate:

* Organisational identity and purpose.
* Membership and roles.
* Internal rules and customs.
* Authority and decision-making.
* Organisational assets and resources.
* Obligations and relationships.
* Organisational plans and commitments.

Examples:

* Churches and religious orders.
* Guilds.
* Noble estates.
* Merchant associations.
* Town councils.
* Courts.
* Schools.
* Military organisations.
* Charitable organisations.

An institution is not simply a building or a group of pawns.

A church building is a physical venue. A church organisation is an institution. Religious beliefs and practices may also exist independently at the individual and cultural level.

Governance concerns authority, collective decisions, rules, obligations and enforcement.

The model should support:

* Taxes, rents, dues and other obligations.
* Rights and legal status.
* Disputes and adjudication.
* Enforcement and legitimacy.
* Debt, default and negotiation.
* Cooperation, resistance and conflict.

An obligation is not merely an automatic transfer of resources. It has a debtor, a beneficiary or authority, a basis, an amount or condition, a due time and a status. Enforcement is a separate process.

### 3.9 Exchange and enterprise

Purpose: Represent voluntary economic exchange and the organisations that conduct economic activity.

Owns:

* Market offers.
* Buying and selling.
* Negotiation and transactions.
* Prices and price formation.
* Trade relationships.
* Commercial contracts.
* Credit and debt where supported.
* Business identity and commercial activity.

A market is a mechanism and set of rules for exchange, not merely a physical location.

A marketplace is a venue where market activity can take place.

A business is an organisation that may own assets, employ people, hold inventory, produce goods, offer services and participate in markets.

Examples:

* Bakeries.
* Smithies.
* Workshops.
* Merchant businesses.
* Inns and taverns.
* Trading companies.

Exchange does not own the goods being exchanged. Resources owns the goods and performs or authorises ownership transfers under the agreed transaction.

### 3.10 Regional and external world

Purpose: Connect the local simulation to a larger world without requiring every distant person and settlement to be simulated in full detail.

Owns or represents:

* Abstract distant settlements and regions.
* External economic and political conditions.
* Regional trade opportunities.
* Distant supply and demand.
* External events and news sources.
* Visitor and migration flows.
* External relationships and connections.

External entities can be represented abstractly while distant. When visitors arrive, they can become fully represented pawns in the local simulation.

Examples:

* Merchant ships arriving and departing.
* Travelling merchants.
* Pilgrims and religious visitors.
* Occasional elites and officials.
* Migrants and skilled workers.
* News of distant conflicts or opportunities.

Ships and boats are transport and trade capabilities, not separate fundamental social domains.

---

## 4. Cross-domain processes and capabilities

### 4.1 Agency and decision-making

Pawns and organisations need agency.

Individual decision-making considers:

* Needs.
* Preferences.
* Skills and capabilities.
* Personality and circumstances.
* Relationships.
* Obligations.
* Household and institutional expectations.
* Opportunities.
* Current plans and commitments.

The player can influence an individual pawn's choices without replacing the underlying agency model.

Agency should be extensible to different decision-making entities, including households and institutions, without assuming that they all use the same decision algorithm.

### 4.2 Planning

Distinguish four concepts:

* Goal: A desired outcome.
* Opportunity: Something that could be done.
* Plan: An intention or proposed sequence of actions to achieve a goal.
* Activity: A concrete piece of work currently being undertaken.

A household can plan construction. An individual pawn can decide to pursue a personal ambition. An institution can plan a festival.

Planning should account for:

* Dependencies.
* Priorities.
* Resource availability.
* Reservations and commitments.
* Labour and skills.
* Time constraints.
* Changing circumstances.
* Abandonment and replanning.

A plan is not a job assignment. It expresses intention and constraints. Individual pawns still exercise agency.

### 4.3 Work and activity coordination

Work coordination connects opportunities, plans and individual actions.

Responsibilities include:

* Discovering available opportunities through domain interfaces.
* Matching activities with capable pawns.
* Respecting household and institutional priorities.
* Considering individual preferences and needs.
* Coordinating activities and interruptions.
* Managing activity-level commitments.
* Reporting progress and completion.

The coordinator must not own domain-specific execution rules.

Construction execution belongs to construction-related production logic. Harvesting belongs to agricultural production. Resource transfer belongs to Resources.

### 4.4 Social interaction

Social interaction coordinates encounters between pawns.

It supports:

* Conversations.
* Relationship formation and change.
* Negotiation.
* Social invitations.
* Ceremonies and gatherings.
* Disputes.
* Informal information exchange.

It must not assume that all interactions occur within a household or settlement.

### 4.5 Domain workflows

Some actions require multiple domains to coordinate.

Examples:

* Marriage.
* Inheritance.
* Household formation.
* Tax collection.
* Construction.
* Apprenticeship.
* Establishing a business.
* Founding a settlement.
* Organising a festival.
* Merchant transactions.

These workflows should be explicit. They coordinate domain operations and handle failure, cancellation and partial progress without taking ownership of all involved state.

---

## 5. Venues and social spaces

A venue is a physical place that supports one or more activities and patterns of social interaction.

Examples:

* Marketplace.
* Tavern or alehouse.
* Inn.
* Church.
* Workshop.
* Guildhall.
* Harbour.
* Festival or fairground.

Distinguish:

1. The physical location.
2. The organisation or business operating it.
3. The activities and interactions that occur there.

Venues should create opportunities for pawns to encounter people outside their normal social networks.

A marketplace attracts purposeful economic encounters. Taverns and alehouses support informal sociability, news and relationship formation. Inns connect locals with travellers. Churches support religious and communal activity. Fairs periodically concentrate people and goods from multiple settlements.

Attendance and encounters should emerge from location, opening hours, cost, reputation, social customs, personal intentions and circumstances.

Visitors should be real participants in the simulation, not simply scripted quest-givers.

Historical differences between inns, taverns and alehouses should be reflected in the setting and period.

---

## 6. Player experience and pawn embodiment

The player inhabits a pawn rather than acting exclusively as an external settlement manager.

The player should be able to:

* Observe the world from a pawn's perspective.
* Influence decisions and activities.
* Set personal goals.
* Pursue self-imposed challenges.
* Form relationships.
* Learn skills and acquire an occupation.
* Participate in institutions and businesses.
* Travel and interact with other settlements.
* Experience social mobility, hardship and opportunity.

The player should be able to pursue lives that the game has not explicitly prescribed.

Examples:

* Escape a dependent or impoverished situation.
* Become a skilled craftsperson.
* Build a successful business.
* Acquire land.
* Become a merchant.
* Join a religious order.
* Gain social or political influence.
* Establish a household.
* Simply live an ordinary life.

Player control is an input into the agency system, not an alternative simulation system.

The player-facing layer owns:

* The currently controlled pawn or perspective.
* Observation and presentation.
* Player intentions and input.
* Personal goal and challenge presentation.
* Interface and feedback.

It does not own the pawn's authoritative state or bypass domain rules.

When the player is not directly controlling a pawn, that pawn should continue to participate in the simulation according to the same underlying rules.

---

## 7. Simulation infrastructure

### World geometry and spatial services

Owns or provides:

* Spatial identity.
* Geometry and topology.
* Spatial indexing.
* Queries for distance, adjacency and reachability.

Domain-specific land rights, ecological properties and infrastructure remain owned by their respective domains.

### Movement

Provides:

* Pathfinding.
* Movement execution.
* Travel costs and constraints.
* Navigation between relevant locations.

Movement does not own social interactions or travel decisions.

### Simulation kernel

Provides:

* Simulation time.
* Scheduling and update ordering.
* Deterministic randomness.
* Execution boundaries.
* Controlled mutation and command processing.

Domain logic should not independently create uncontrolled time progression or nondeterministic side effects.

### Commands and events

Commands represent requested changes or actions.

Events represent meaningful facts that have occurred.

A command may fail. An event records something that has happened.

Not every internal state mutation needs to become a permanent event.

Commands and events should have explicit semantics, ownership and ordering.

### Persistence

Provides save/load and restoration of the authoritative simulation state.

Persistence must preserve relationships and references across domains. It should not require presentation-specific state to reconstruct domain truth.

### Presentation

Renders the world and communicates simulation state to the player.

Presentation must not own simulation rules or mutate domain state directly.

---

## 8. Architectural rules and principles

### Rule 1: Explicit ownership

Every authoritative piece of state has one clear owner.

Other domains may reference it, query it or request changes through its interface. They must not independently mutate it.

### Rule 2: Well-defined interfaces

Every system boundary must expose an explicit interface.

An interface should make clear:

* What information can be queried.
* What operations can be requested.
* What preconditions apply.
* What invariants are maintained.
* What events or results may follow.
* Which errors or failure conditions are possible.

Do not expose internal mutable collections or implementation details.

### Rule 3: No hidden cross-system mutation

A system must not reach into another system's state and modify it directly.

Cross-domain changes happen through explicit operations or coordinated workflows.

### Rule 4: Separate ownership from coordination

A process that coordinates several domains does not become the owner of their state.

### Rule 5: Separate intention from execution

Goals, opportunities, plans, activities and domain execution are distinct concepts.

A household plan does not directly force an individual pawn to work. An activity does not itself own the resources or production rules it uses.

### Rule 6: Separate rights, ownership and authority

Physical possession, resource ownership, land rights, access rights, social status and political authority are distinct concepts.

Do not collapse them into a generic owner or controller field.

### Rule 7: Support relationships across boundaries

People, households, institutions, settlements, land and businesses can have relationships across geographical and organisational boundaries.

Do not assume that membership in one entity implies membership in another.

### Rule 8: Avoid universal knowledge

Pawns and organisations should not automatically know all simulation state.

Information, discovery, reputation and communication should be represented through explicit mechanisms where they matter.

### Rule 9: Deterministic and testable simulation

Given the same initial state, commands, time progression and random seeds, the simulation should produce reproducible results.

Use controlled random streams where appropriate. Avoid dependence on incidental execution order.

### Rule 10: Failure is part of the model

Operations can fail, plans can become invalid, transactions can be cancelled, obligations can be disputed and activities can be interrupted.

Interfaces must make these outcomes explicit.

### Rule 11: Prefer composition over hard-coded categories

A profession, social class, institution or business should emerge from capabilities, relationships, rights, resources and rules wherever practical.

Do not create a new fundamental system for every noun in the game.

### Rule 12: Do not over-decompose

A conceptual boundary does not automatically justify a separate module.

Split systems when they have independent state ownership, invariants, reasons to change or useful test boundaries.

### Rule 13: Domain events are meaningful facts

Events should describe things that happened, not merely expose every internal implementation step.

### Rule 14: Preserve simulation independence from the UI

The simulation must be runnable and testable without rendering or player-interface dependencies.

### Rule 15: Evolution must be incremental

The architecture should accommodate new features without requiring broad rewrites or changes to unrelated systems.

---

## 9. Definition of a good subsystem

A subsystem is well-designed when:

1. Its purpose can be explained clearly.
2. Its authoritative state is identifiable.
3. Its invariants are explicit.
4. Its public interface is small and understandable.
5. Its dependencies are intentional.
6. It can be tested independently.
7. It can evolve without requiring unrelated systems to change.
8. Its internal representation can change without breaking its consumers.

A subsystem is not well-designed merely because it has its own directory, class or file.

---

## 10. Architectural success criteria

The architecture should support the following without fundamental redesign:

* A pawn belongs to a household in one settlement, works for an institution in another, owns land elsewhere, owes obligations to a lord, trades in a regional market and maintains personal relationships across all those places.
* A household plans a barn while individual pawns autonomously decide which activities to undertake.
* A landowner collects rents or taxes without directly owning the tenant household's inventory or decisions.
* A merchant travels by boat, participates in a local market, forms relationships and returns home.
* A baker operates a business, employs apprentices, buys flour and sells bread.
* A church owns property, organises ceremonies and influences social life without owning religious belief itself.
* A pawn becomes an apprentice, acquires skills and eventually establishes an independent workshop.
* A player inhabits a pawn and pursues an unprescribed life without bypassing the simulation's rules.
* A tavern creates social encounters between people who would not otherwise meet.
* A village becomes a town and develops increasingly complex institutions and regional trade.

The target is not a simulation that implements every historical institution immediately. It is a simulation whose architecture can support these developments through coherent extensions of existing concepts.
