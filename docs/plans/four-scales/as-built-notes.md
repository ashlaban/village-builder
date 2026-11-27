# Notes on what the code does until the arch `plans` builds each row

Moved word for word from `design.md` on 27 November 2026 (Kim, K10 of the consistency review). Each note was a sentence beginning "Was, and stands in the code until the arch `plans` builds this" in the row named in its header; the row in `design.md` now states the design alone.

## The alderman's keep

From the `design.md` row "The alderman's keep".

Was, and stands in the code until the arch `plans` builds this (VB-1767): called by him for a day at least 3 days ahead as tasks of his plan; days not called by the year's end lapse.

## The day's work

From the `design.md` row "The day's work".

Was, and stands in the code until the arch `plans` builds this (VB-1758, VB-1760): The head allots the household's day: each morning, again at 14:00, when the afternoon's urgencies change (the water's rises above the cooking's, the cook's window opens; `MATCH.day.afternoon`, backlog VB-1546), at its review, and when its tasks or its village's change, every member is weighed for every task of the household and of the village it may take (its role's priority for the kind times the task's urgency, less the walk), and each gets an ordered list. Best fit first; a further hand on a task counts for 0.8 of the one before, so the hands spread over what can be worked at once; a task is given hands until they finish it within half a working day, each member up to its own hours of that time; then each list goes on with whatever else the member may take, so no one stands idle while there is work. No lots are drawn: households differ by their heads. A pawn works down its list, taking the first task that has room. The day is the plan's, and saved with it. A task the due-queue opens in the day (the milking, the meal, fodder) is weighed alone, each member for that task, and slotted into the lists as they stand: the head knew in the morning that it would come; the whole day is weighed anew at the morning, at 14:00, at the head's review and when a member looks for work, and a task with a deadline today still calls its hand (it was: weighed anew whenever its tasks changed; VB-1554 measured 4.4 allotments a household-day, half of the pairs weighed for a task newly due)

## Acting without the plan

From the `design.md` row "Acting without the plan".

Was, and stands in the code until the arch `plans` builds this (VB-1762): Any member may act on the household's opportunities, preferring the plan's tasks

## Standing duties

From the `design.md` row "Standing duties".

Was, and stands in the code until the arch `plans` builds this: An idea kept, with no mechanism (Kim, 23 Nov): a member is the one who sees to a type of work (the wood, the beasts), the same today as yesterday unless something changed, and the head may say whose it is. The day as allotted already repeats itself: 72 to 73% of member-days begin with the type of work of the day before (populous small, seeds 7 and 11, 2 years), since the fits change little from one morning to the next. The mechanism tried and removed (VB-1553): a factor `MATCH.keep` on the fit for a type the morning before gave the member; at 1.25 it added three points to that share, at the cost of the haymaking (hands that keep to yesterday's type come late to work that opens with a season: `tests/hay.js` and `tests/meadows.js` red at every value above 1) and more hungry days at one seed of two. A mechanism for it is open: it must not delay work with a window, and it should give the played head a choice that weighs

## Own time

From the `design.md` row "Own time".

Was, and stands in the code until the arch `plans` builds this (VB-1762): A pawn of working age with no task it may take (Work beats idling, below) has the wait to itself and chooses a pastime, where it idled about: from a table of pastimes (`sim/pastimes`), each saying who may choose it, where it is spent, with whom and what weighs for it. The first table: company (join one it likes who is also free, as built), a visit (walk to the farm of a friend or near kin in its village and sit with those at home there), the green, the fire (at home with its housemates: more in winter, and for the old and the weak), play (children of 7 to 13 with the village's other children, on the green or in a yard), and by the herd for one who holds it at the side. It chooses by its own traits (sociability towards company and a visit), its ties and liking (whom) and the walk: a weighted draw from the stream `talk`, as company was. A pastime is a walk and a wait and nothing more: it lasts as the idle wait did (4 to 8 hours, by diligence), is cut by the head's call, by a task that opens for the pawn and by the night as any leg is, makes and uses no good, and has only the social effects of the encounter it puts the pawn in (Where pawns meet); mood does not weigh in it (Mood: read by one rule). The pawn's card says what it is doing and with whom ("Visiting Karin at Norrgård"). A pastime is chosen through a verb (`pastime`) that the played pawn has too, in its Actions under Myself. Work for the spare hours that makes a good (spinning, *slöjd*) is a task at the side (Attention), not a pastime

## A member's voice

From the `design.md` row "A member's voice".

Was, and stands in the code until the arch `plans` builds this (VB-1763): A member may ask its head. The first ask is leave: free hours today, from now or from an hour named to the end of the working day, an offer on the basis `leave` (The round as offers: one asks, the other answers, once). The head answers by its day: no when its estimate says the household's tasks with a window closing or a deadline today want the member's hours, else by its opinion of the member and its own diligence; a yes takes the member out of the day's allotment for those hours (the head allots around it, as around one away), and they are its own time; a no is a memory of the member's, as any refusal is. A pawn asks of its own accord when it wants a pastime the hours left free do not give it: one who courts, or one who has not sat with a close friend or near kin for `VOICE.days` (6, half a season), at most once in that time. The second ask, a duty (a type of work as its own), waits for a mechanism of Standing duties (above). The played pawn that is not its household's head asks in the same way, and the played head is asked and answers, its pawn's judgement shown as advice. Knowledge moves at once: an ask needs no walk to the head

## Village routines

From the `design.md` row "Village routines".

Was, and stands in the code until the arch `plans` builds this (VB-1768): the routine's tasks are the village's, taken by any adult of the village on the basis `villager`, and nobody owes them

## Work beats idling

From the `design.md` row "Work beats idling".

Was, and stands in the code until the arch `plans` builds this: A pawn takes any allowed job that suits its role rather than stand idle, however far or low in urgency, so every posted job gets done; firewood for the winter is laid in from summer (backlog VB-103); with no allowed work the wait is its own (Own time, above)

## Village work days

From the `design.md` row "Village work days".

Was, and stands in the code until the arch `plans` builds this (VB-1768): The meeting sets days on which the whole village works together: closing the infield fence before the animals go out, clearing the commons; a household that does not turn up loses standing (backlog VB-120)

## Multi-step jobs

From the `design.md` row "Multi-step jobs".

Was, and stands in the code until the arch `plans` builds this: Each a leg (A leg, and its end, above). Walk to the site, work, carry the load home (sheaves to the barn, hay to the hay barn, wood to the woodpile, water indoors)

## Obligations

From the `design.md` row "Obligations".

Was, and stands in the code until the arch `plans` builds this (VB-1767): three sources (VB-404's plan, 15 Nov), a debt's remedy, the alderman's keep and a patron's due; each a count of days one household owes another within a year, called by the creditor's holder for a day at least 3 days ahead and worked as tasks of the creditor's plan by one adult of the owing household, who walks there and carries his meal

## Remedies: "Debts are paid with"

From the `design.md` row "Remedies: "Debts are paid with"".

Was, and stands in the code until the arch `plans` builds this (VB-1767, VB-1769): the days called by the creditor's holder, on the basis `debtor`
