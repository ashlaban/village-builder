# Village Builder — Architectural Principles, Invariants and Stress Tests

*External proposal, not design. Written by ChatGPT in a review session with Kim and passed on on 3 November 2026; the third of three
documents (with `target-architecture.md` and `prompt.md`). The text is as received; only Markdown markup was added and apostrophes
straightened. What the project took from it is in `docs/review-architecture.md`; most scenarios here need systems the game does not have
yet, and are kept as checks for when they do.*

---

## 1. Purpose

This document defines the properties that the Village Builder architecture must preserve as the simulation grows.

It is not merely a collection of unit tests. It contains:

* Architectural invariants.
* Interface and ownership rules.
* Domain-level behavioural tests.
* Cross-domain workflow tests.
* End-to-end social simulation scenarios.
* Tests of player embodiment and agency.
* Extensibility tests.
* Criteria for accepting architectural changes.

The central question is:

> Can the simulation grow in complexity without losing clear ownership, independent domain behaviour, deterministic execution or the ability to test systems separately?

A successful architecture must support a complex society without requiring a single system to understand or own the whole society.

---

## 2. Core architectural principles

### Principle 1: One authoritative owner per piece of state

Every authoritative fact has one owner.

Other systems may hold references, derived information or cached representations, but they must not become competing authorities.

Examples:

* Society owns a pawn's identity.
* Households own household membership and plans.
* Land owns land rights.
* Resources owns inventory quantities and resource ownership.
* Exchange owns market offers and transaction state.
* Institutions own their organisational membership and rules.

A fact may be relevant to several domains without being owned by all of them.

Test: Identify a state item and determine which subsystem can authoritatively change it. There must be one unambiguous answer.

### Principle 2: Interfaces define allowed relationships

A dependency between systems should be visible through an interface.

Consumers should not need to know the internal representation of another subsystem.

Test: Replace or substantially change one subsystem's internal data representation. Its consumers should continue to work if the public contract remains unchanged.

### Principle 3: Coordination does not imply ownership

A workflow can coordinate many domains without owning their state.

Test: Trace a multi-domain operation. Each state transition must be performed by its authoritative owner.

### Principle 4: The simulation is not a centralised manager

A central kernel may schedule and execute simulation work, but it must not become the owner of all game rules.

Test: A new production method should not require modifying a universal simulation manager beyond registering or scheduling the relevant operation, if registration is needed at all.

### Principle 5: Independent domains remain independently meaningful

A domain should be understandable and testable without running the entire game.

Test: Its important invariants and operations can be tested using its interface and controlled dependencies.

### Principle 6: Relationships cross organisational and geographical boundaries

A pawn is not defined by one household, settlement, employer or institution.

Test: Construct a pawn with simultaneous relationships across multiple domains and locations.

### Principle 7: Rights, ownership, authority and possession remain distinct

A person may use, own, control, rent or be responsible for something without those concepts being interchangeable.

Test: A tenant can cultivate a lord's land, own the harvest, owe rent and retain household decision-making autonomy.

### Principle 8: Plans express intention, not guaranteed outcomes

Plans can fail, be interrupted, become invalid or be abandoned.

Test: Invalidate a plan's resources or opportunity and confirm that the simulation responds coherently without corrupting other plans.

### Principle 9: Pawns retain agency

Household and institutional priorities influence individual decisions but do not automatically erase individual needs and preferences.

Test: A pawn can refuse, delay, interrupt or autonomously initiate an activity according to the decision rules.

### Principle 10: The player participates through normal simulation rules

Player-controlled pawns must use the same domain operations as autonomous pawns.

Test: The player cannot create goods, acquire rights, bypass travel constraints or complete activities by directly mutating state.

### Principle 11: Information is not universally available

Knowledge and information should have an appropriate source and means of transmission.

Test: A pawn in one settlement does not automatically know private information from another settlement without a plausible information path.

### Principle 12: Deterministic execution

Given the same initial state, inputs, time progression and random seeds, the simulation should reproduce the same results.

Test: Run representative multi-domain scenarios repeatedly and compare the resulting authoritative state and event sequences.

### Principle 13: The architecture should grow through composition

New professions, venues, institutions and social roles should use existing capabilities where possible.

Test: Add a new profession or venue without changing unrelated domain interfaces.

### Principle 14: Complexity should be earned

Do not create new subsystems or generic abstractions merely because a future feature might need them.

Test: Every proposed boundary has a current or clearly justified responsibility, state ownership or testability benefit.

---

## 3. Interface contract tests

Every meaningful subsystem should be evaluated against these questions.

### Ownership

* What authoritative state does it own?
* What state does it merely reference?
* Can another subsystem mutate its state?
* Are derived values clearly distinguished from authoritative facts?

### Queries

* Are queries explicit and understandable?
* Do queries return safe data rather than mutable internals?
* Are unknown, unavailable and invalid results distinguishable?
* Are query results consistent with the simulation's temporal model?

### Operations

* Are commands and domain operations explicit?
* Are preconditions documented?
* Are invariants preserved?
* Can operations fail?
* Are partial results or cancellation handled explicitly?

### Events

* Are meaningful state changes observable?
* Are events facts rather than vague notifications?
* Are event ordering and timing defined?
* Are consumers prevented from treating events as permission to mutate unrelated state?

### Dependencies

* Are dependencies intentional?
* Are there circular dependencies?
* Does the subsystem depend on presentation?
* Does it know too much about unrelated domain models?

### Evolution

* Can internal implementation change without breaking consumers?
* Can new functionality be added without broad changes?
* Are contracts sufficiently narrow?

A subsystem should not be considered architecturally complete merely because it exposes a handful of public methods.

---

## 4. The multi-membership pawn test

This is a central architectural stress test.

### Scenario

A pawn:

* Belongs to a household in Village A.
* Works for a guild or institution in City B.
* Owns land in Village C.
* Owes taxes or rent to a lord.
* Trades goods in a regional market.
* Maintains friendships and family relationships across all three settlements.
* Visits a tavern in City B and meets a merchant from another region.
* Has personal ambitions that conflict with some household expectations.

### Questions

#### Identity

* Does the pawn remain one persistent person across all these contexts?
* Can each subsystem refer to the pawn without owning the pawn's identity?

#### Household

* Can the pawn remain a household member while working elsewhere?
* Does temporary absence imply departure?
* Can household obligations continue during absence?

#### Employment and institutions

* Can the pawn work for an institution without becoming a member of the institution?
* Can the pawn have several roles or affiliations?
* Can employment end without changing household membership?

#### Land

* Can the pawn own land in a different settlement?
* Can the pawn grant use rights to another household?
* Can land rights change without transferring the pawn's identity or household membership?

#### Obligations

* Can the pawn owe rent or taxes to an authority?
* Can an obligation be disputed, paid, overdue or enforced?
* Can failure to pay create consequences without directly mutating the debtor's inventory from the governance system?

#### Exchange

* Can the pawn offer goods for sale?
* Can the pawn buy goods without the market owning their inventory?
* Can the pawn trade while being subject to other obligations?

#### Relationships

* Can the pawn maintain relationships across settlements?
* Can relationships change when people move apart?
* Can a relationship exist independently of household membership?

#### Information

* Does the pawn know about events in distant settlements only through plausible information paths?

#### Player control

* Can the player inhabit this pawn and participate in all these activities without receiving privileged access to domain state?

### Acceptance criteria

The scenario passes when:

* No single subsystem owns the whole pawn or all the pawn's relationships.
* Every state category has an authoritative owner.
* Each domain exposes the information and operations required by others.
* Geographical separation does not imply organisational separation.
* Cross-domain workflows are explicit.
* No system needs to inspect arbitrary internal data in every other system.

This scenario should be implemented as a representative integration test when the underlying capabilities exist.

---

## 5. Economic and institutional stress tests

### Test A: Landowner extracting rent

A lord owns land. Several households cultivate it.

The system must support:

* Land ownership.
* Tenure or use rights.
* Household cultivation.
* Production of goods.
* An obligation to pay rent.
* Assessment and collection.
* Transfer of goods or currency.
* Non-payment and consequences.

Verify:

* The lord does not own the tenant household.
* The lord does not own the tenant's entire inventory.
* The household controls its own planning.
* The obligation is distinct from the actual payment.
* Resources performs the transfer.
* Governance or the relevant institution owns the authority and obligation.
* Disputes and failures can be represented.

### Test B: Tax collection

An authority establishes a tax.

The tax:

1. Has a legitimate or recognised basis.
2. Identifies the responsible party.
3. Specifies the amount or calculation rule.
4. Has a due condition or date.
5. Can be assessed.
6. Can be paid or collected.
7. Can be disputed, overdue or enforced.

Verify that taxation is not implemented as a direct periodic subtraction from every household inventory.

### Test C: Household planning

A household decides to build a barn.

It has:

* A goal.
* A plan.
* Resource requirements.
* Labour requirements.
* A priority.
* Dependencies.

Individual pawns consider the plan alongside their needs, skills, preferences and commitments.

Verify:

* The household plan does not force all members to work.
* The activity coordinator does not own construction rules.
* Resource reservations prevent competing plans from spending the same materials.
* Work can be interrupted.
* The plan can be reconsidered if circumstances change.

### Test D: Business formation

A skilled baker establishes a bakery.

The bakery:

* Has an owner or organisational structure.
* Acquires or rents premises.
* Acquires an oven and tools.
* Buys flour.
* Produces bread.
* Employs an apprentice.
* Sells bread through a market.

Verify:

* The baker's identity and skills belong to Society.
* The business is distinct from the baker.
* The business can hold resources.
* Production rules belong to Production.
* Market transactions belong to Exchange.
* Resource ownership changes through Resources.
* The business can continue operating if its owner is temporarily absent, where the rules permit.

### Test E: Apprenticeship

A pawn enters an apprenticeship with a smith.

Verify:

* The pawn has an individual skill and learning progression.
* The smith or workshop has relevant capabilities.
* The relationship or contract is explicit.
* Work and learning activities can be coordinated.
* The apprentice can leave or complete the apprenticeship.
* The pawn's acquired knowledge persists independently of the employer.

---

## 6. Market and regional economy stress tests

### Test A: Local marketplace

Several households and businesses bring goods to a marketplace.

Verify:

* Sellers own the goods they offer.
* Offers do not automatically transfer ownership.
* Buyers have sufficient resources or credit.
* A completed transaction transfers ownership through Resources.
* Failed or cancelled transactions leave inventories consistent.
* Prices can respond to supply and demand without being owned by every producer.

### Test B: Regional trade

A merchant travels between settlements.

Verify:

* The merchant can access multiple markets.
* Goods are transferred between locations.
* Travel has costs and constraints.
* Prices can differ between settlements.
* Information about distant prices is not universally available.
* The merchant can respond to opportunities.
* The merchant's business and personal identity remain distinct.

### Test C: Merchant boat

A merchant boat arrives at a harbour.

It brings:

* A merchant or crew.
* Goods.
* News or information.
* Possible visitors.

Verify:

* External entities can be represented abstractly before arrival.
* Arriving pawns become ordinary participants in the local simulation.
* Goods enter local resource ownership through explicit operations.
* The ship's arrival can create market opportunities.
* Departure does not delete relationships or transactions already established.

### Test D: Market disruption

A major supply source fails to arrive.

Verify:

* Supply changes.
* Prices and availability can respond.
* Businesses may alter production.
* Households may change plans.
* Pawns may seek alternative suppliers.
* No global market update needs to directly mutate every household's plans.

---

## 7. Social interaction and venue tests

### Test A: Tavern encounters

A pawn visits an alehouse.

The venue attracts:

* Local workers.
* Craftspeople.
* Travellers.
* Merchants.
* Occasional visitors.

Verify:

* Attendance follows rules and individual decisions.
* The venue has a location, operator, capacity and relevant characteristics.
* Encounters occur between pawns who share the venue at compatible times.
* Social relationships can form independently of economic transactions.
* Information can be exchanged without automatically becoming universal knowledge.
* Encounters can create opportunities without requiring scripted quests.

### Test B: Social networks across settlements

A pawn has:

* A sibling in another village.
* A former employer in a city.
* A friend who is a travelling merchant.
* A religious contact in a monastery.

Verify that all relationships remain valid and independently represented.

### Test C: Church and religion

A church:

* Has an organisation.
* Has clergy and other roles.
* Owns or controls property.
* Organises ceremonies.
* Attracts visitors.
* Has relationships with local households and authorities.

Verify:

* The church organisation is distinct from the physical building.
* Personal beliefs are not owned by the church.
* Membership and religious identity can change.
* Ceremonies can affect social relationships and community life.
* Church property uses normal land and resource ownership rules.

### Test D: Fair or festival

A periodic fair brings people from several settlements together.

Verify:

* Visitors arrive and depart.
* Temporary venues and offers can exist.
* Social and economic encounters increase.
* News and knowledge can spread.
* The event can occur again without duplicating persistent identities or corrupting relationships.

---

## 8. Player embodiment and life-path tests

### Test A: Ordinary life

The player inhabits a pawn who works, eats, sleeps, maintains relationships and participates in household life.

Verify:

* The pawn remains part of autonomous simulation.
* Player input influences choices without replacing simulation rules.
* Other pawns continue their lives.
* The pawn's needs and commitments still matter.

### Test B: Social mobility

A poor pawn pursues a path to wealth.

Possible steps:

* Find an apprenticeship.
* Acquire skills.
* Earn income.
* Establish a business.
* Accumulate assets.
* Acquire property or influence.

Verify that this progression emerges through normal systems rather than a hard-coded social ladder.

### Test C: Escape from dependency

A pawn seeks to leave a dependent household or oppressive arrangement.

Verify:

* Household membership and legal/social obligations are distinct.
* Leaving has coherent consequences.
* The pawn can pursue alternatives.
* The relevant institution or authority may respond.
* The player cannot bypass constraints through privileged mutation.

### Test D: Self-imposed challenge

The player decides to become wealthy without owning land.

Verify:

* The game does not require a predefined quest.
* The player can pursue a personal goal through existing economic capabilities.
* Progress can be observed.
* The simulation does not need to know in advance that this is a recognised career path.

### Test E: Loss of control

The player stops directly controlling a pawn or changes perspective.

Verify:

* The pawn continues to behave according to the normal agency model.
* Plans and commitments remain valid.
* No special player-only state is required for the pawn to continue functioning.

---

## 9. Lifecycle, health and continuity tests

The simulation should be able to represent people across their lives.

Test:

* Birth and household formation.
* Childhood and dependency.
* Learning and apprenticeship.
* Employment and occupational change.
* Marriage and partnership.
* Ageing and declining capabilities.
* Injury and illness.
* Death and inheritance.
* Household division and dissolution.
* Institutional succession.

Verify:

* Personal identity persists appropriately.
* Relationships remain coherent.
* Resources and rights are transferred through explicit rules.
* Obligations are handled when a person dies or becomes unable to fulfil them.
* Skills and knowledge can be transmitted across generations.
* A household can change without rewriting the identities of its members.

---

## 10. Information and knowledge tests

A society needs imperfect information.

Test:

* A merchant learns about prices in another settlement.
* A traveller brings news of a distant event.
* A rumour changes how people regard a pawn.
* An apprentice learns a technique from a master.
* A religious practice spreads through contact.
* An institution keeps some information private.

Verify:

* Information has a source.
* Information can be transmitted.
* Different pawns can hold different beliefs about the same event.
* Knowledge is not automatically identical to authoritative world state.
* Information can be incomplete, delayed or inaccurate where appropriate.

---

## 11. Determinism and simulation integrity tests

The architecture must support repeatable simulation.

Test:

* Run the same initial state and inputs repeatedly.
* Compare authoritative state after each simulation step.
* Compare relevant event sequences.
* Test operations that consume random values.
* Change presentation frame rate without changing simulation outcomes.
* Change unrelated presentation code without changing simulation outcomes.
* Reorder independent system execution where the architecture claims the operations are independent.

Verify:

* Randomness is controlled.
* Time progression is explicit.
* Mutation order is defined where it matters.
* No hidden global state affects outcomes.
* Presentation does not alter simulation behaviour.
* Save/load preserves simulation state and subsequent deterministic behaviour.

---

## 12. Architectural change impact tests

These tests measure how easy the architecture is to extend.

### Change A: Replace village-posted jobs with household planning

The system changes from a village publishing jobs to households planning work and individuals choosing activities.

Expected impact:

* Household planning gains responsibility for household intentions.
* Individual agency considers those intentions.
* Activity coordination handles activity selection.
* Production domains continue to own execution.
* Resources continues to own resource state.

A change to the planning model should not require unrelated changes to land ownership, kinship or rendering.

### Change B: Add a new profession

Add a new profession, such as a potter.

Expected impact:

* Society can represent relevant skills.
* Production can represent the productive method.
* A business or institution can provide the workplace.
* Exchange can support selling the output.
* Resources handles materials and finished goods.

No new fundamental profession system should be required.

### Change C: Add a new institution

Add a monastery.

Expected impact:

* The institution model supports identity, membership, roles, rules and assets.
* Society supports personal affiliations and beliefs.
* Land and Resources support property.
* Social interaction supports relevant encounters.
* Governance supports authority and obligations where appropriate.

No unrelated household or market redesign should be required.

### Change D: Add a new venue

Add a bathhouse or communal hall.

Expected impact:

* It can use the venue model.
* It can be operated by an organisation or business.
* Social interactions can occur there.
* Attendance follows normal agency and spatial rules.

No new social-interaction engine should be necessary.

### Change E: Add a new external visitor type

Add a travelling scholar.

Expected impact:

* The external world can represent the visitor before arrival.
* Society represents them as a person when locally simulated.
* Their knowledge and relationships use existing interfaces.
* They can attend venues and interact with institutions.

No new identity model should be needed.

---

## 13. Negative architectural tests

The following should be treated as architectural violations.

* A system directly mutates another domain's authoritative state.
* A central manager owns domain-specific rules for unrelated systems.
* A household plan directly deducts goods from Resources without an explicit operation.
* A market owns the inventories of its participants.
* A settlement owns the identity of all its residents.
* A church owns the beliefs of its members.
* A profession is represented only by a rigid pawn subtype.
* A pawn cannot belong to multiple organisations or maintain relationships across settlements.
* A player-controlled pawn bypasses normal simulation rules.
* A UI component directly changes simulation state.
* A system assumes all pawns know all world state.
* A work coordinator implements the rules of every productive activity.
* A generic event bus is used to conceal undefined ownership and dependencies.
* A new feature requires arbitrary direct access to numerous unrelated systems.
* An internal refactor changes public behaviour without updating tests or documentation.

These should be checked in code review and, where feasible, enforced through static checks or tests.

---

## 14. Test implementation strategy

Do not attempt to implement every scenario as a full end-to-end test immediately.

Build a layered test suite.

### Layer 1: Unit tests

Test individual domain invariants and operations.

Examples:

* Resource transfer preserves quantities.
* Land rights prevent unauthorised use.
* Household membership changes preserve identity.
* An institution cannot assign an invalid role.
* A transaction cannot transfer goods that are unavailable.

### Layer 2: Interface contract tests

Test that public operations preserve their documented behaviour and invariants.

### Layer 3: Domain integration tests

Test collaborations between a small number of domains.

Examples:

* Production creates goods in Resources.
* Exchange transfers ownership through Resources.
* Governance establishes an obligation that Resources can settle.
* Society records relationships formed through social interaction.

### Layer 4: Workflow tests

Test complete multi-domain processes.

Examples:

* Apprenticeship.
* Tax collection.
* Construction planning.
* Business formation.
* Merchant trade.

### Layer 5: Simulation scenario tests

Run longer simulations involving households, settlements, institutions, markets and autonomous pawns.

Check important outcomes and invariants rather than relying exclusively on exact snapshots.

### Layer 6: Architectural fitness tests

Automate checks for:

* Forbidden dependency directions.
* Direct cross-domain mutation.
* Cyclic dependencies.
* Presentation dependencies inside simulation domains.
* Undocumented public interfaces.
* Determinism regressions.

Use the simplest testing mechanism that can reliably enforce the property.

---

## 15. Review criteria for every architectural change

Before accepting a significant architectural change, answer:

1. What state does this change introduce or modify?
2. Who is its authoritative owner?
3. Which invariants must always hold?
4. Which interfaces are involved?
5. Which systems depend on those interfaces?
6. Is this a domain responsibility or a coordinating process?
7. Does this create a new dependency?
8. Can the behaviour be tested independently?
9. What happens when the operation fails or is interrupted?
10. Does the change preserve deterministic simulation?
11. Can this capability be composed with existing capabilities?
12. Does the change introduce unnecessary abstraction?
13. What existing scenarios might it break?
14. Can the implementation be changed later without breaking unrelated systems?

A change should not be accepted merely because the feature works in one happy-path demonstration.

---

## 16. Definition of architectural success

The architecture is succeeding when:

* Every authoritative state category has a clear owner.
* Every meaningful system boundary has an explicit contract.
* Cross-domain workflows are explicit and testable.
* New professions, institutions, venues and economic activities can be added without redesigning the whole simulation.
* Pawns can participate in multiple social, economic and geographical contexts.
* Player control uses the same simulation rules as autonomous behaviour.
* The world continues to function without player intervention.
* Deterministic behaviour can be reproduced.
* Domain systems can be tested without rendering the game.
* Architectural changes remain local where their responsibilities are local.

The ultimate test is not whether the code matches a diagram.

It is whether the simulation can express a complex, interconnected society while remaining understandable, testable and evolvable.
