# 🌷 Personal Nutrition Garden
## Product Specification V1.0

**Status:** Final Product Specification  
**Purpose:** Source of truth for what the application should do  
**Audience:** Product owner, designer, developer, AI coding agents

---

# 1. Product Overview

Personal Nutrition Garden is a personal desktop-first calorie and wellness application designed around healthy weight gain.

The application combines:

- calorie tracking
- nutrition tracking
- weight tracking
- BMI calculation
- home workouts
- water tracking
- sleep tracking
- mood tracking
- manual step tracking
- progress visualization
- an evolving personal garden
- a companion bunny
- an AI fairy companion
- AI-assisted food logging
- meal recommendations
- recipes
- achievements

The application should feel like:

> **"A little food diary that wants to see you thrive."**

The overall experience should feel like:

> **My personal nutrition garden.**

---

# 2. Product Philosophy

The application should be:

- helpful
- productive
- encouraging
- playful
- whimsical
- imaginative
- personal
- visually calming
- non-judgmental

It must NOT feel like:

- a clinical medical dashboard
- a rigid fitness tracker
- a calorie punishment system
- a generic AI chatbot
- a productivity application full of spreadsheets
- a "vibe coded" application

The whimsical style should feel intentional and polished rather than childish or cluttered.

---

# 3. Visual Direction

The visual identity is:

> **Whimsical Botanical + Dreamy Digital Diary**

The environment should feel like a personal magical garden combined with a modern digital diary.

Visual characteristics:

- botanical elements
- flowers
- leaves
- soft organic shapes
- dreamy atmosphere
- gentle animations
- handwritten/diary-inspired details where appropriate
- modern readable typography
- subtle magical elements
- warm and friendly visual hierarchy

The application should remain practical and readable.

Whimsy must enhance the experience rather than interfere with usability.

---

# 4. Main Companion Characters

## 4.1 Bunny

The application contains a small animated bunny.

The bunny represents the user's progress and accompanies the user through the application.

The bunny should:

- appear throughout the experience where appropriate
- react to progress
- celebrate milestones
- evolve over time
- visually reflect garden progression
- provide emotional personality without becoming distracting

The bunny's evolution is determined by garden progression.

---

# 5. AI Fairy

The application contains an AI fairy companion.

The fairy should feel:

- warm
- friendly
- encouraging
- conversational
- supportive
- lightly playful

The fairy should not behave like a strict coach.

The fairy should not shame the user for:

- missing calories
- missing workouts
- eating less than expected
- missing tracking
- having an inconsistent day

The fairy should provide gentle guidance.

---

# 6. Main Application Purpose

The primary purpose is to help the user:

1. Understand their nutritional intake.
2. Reach a healthy weight-gain goal.
3. Understand their calorie target.
4. Track progress over time.
5. Maintain a consistent home-workout routine.
6. Track supporting wellness habits.
7. Make the process enjoyable through the garden and bunny system.

---

# 7. Body Information

During onboarding the user enters:

- age/date of birth
- sex
- height
- weight
- preferred unit system
- activity level
- goal weight

The application supports both:

### Metric

- kilograms
- centimeters

### Imperial

- pounds
- feet + inches

The user should be able to choose their preferred display system.

Internally, the application uses canonical metric units.

---

# 8. BMI

The application calculates BMI from:

- current weight
- height

BMI should be presented as an informational measurement.

The application must not treat BMI as a diagnosis.

The application should avoid judgmental statements.

---

# 9. Weight-Gain Goal

The meaning of "gain weight" for this application is:

> Support gradual, sustainable weight gain rather than aggressive weight gain.

The user provides a goal weight.

The application tracks:

- current weight
- goal weight
- difference from goal
- historical weight
- weight trend
- progress toward goal

---

# 10. Weight Progress Graph

The application should provide a visual weight-progress graph.

The graph should show:

- historical weight
- current weight
- trend
- goal weight

The graph should prioritize trend visibility rather than emphasizing daily fluctuations.

---

# 11. Calorie Target

The application calculates an estimated calorie target based on:

- BMR
- activity level
- estimated TDEE
- weight-gain goal

The target is an estimate rather than medical advice.

The application should allow the user to review and adjust the target.

---

# 12. Adaptive Calorie Goal

The calorie target should NOT change silently.

The application monitors the user's weight trend.

If the trend indicates that weight has not changed for several weeks, the application can suggest reviewing the calorie target.

If weight increases faster than expected, the application should also suggest reviewing the target.

The application should recommend changes rather than silently applying them.

---

# 13. Food Logging

Food can be entered through a combination of:

### Manual entry

The user searches/selects a food and enters the quantity.

### Natural-language entry

The user can write something such as:

> "I had two eggs and toast."

AI interprets the food description.

The user must be able to review the interpretation before it is saved.

---

# 14. AI Food Interpretation

The AI should help identify:

- food items
- quantities
- units
- preparation methods where relevant

If information is ambiguous, the AI should ask for clarification rather than inventing a value.

Example:

> "I had a bowl of rice."

The application may ask:

> "Was it a small, medium, or large bowl?"

---

# 15. Nutrition Tracking

The application tracks:

- calories
- protein
- carbohydrates
- fats
- fiber
- available micronutrients

The application should not force the user to obsess over every nutrient.

Nutrition information should be presented progressively and clearly.

---

# 16. Eating Philosophy

The application should support flexibility.

The user does not need to follow a rigid food list.

Meal recommendations should help the user reach nutritional goals without creating unnecessary restrictions.

The application should focus on:

- sufficient calories
- adequate protein
- balanced nutrition
- consistency
- sustainable habits

---

# 17. AI Meal Recommendations

The AI can recommend meals based on:

- remaining calories
- protein needs
- user preferences
- previous food choices
- available information
- time of day

Recommendations should remain suggestions.

The AI should not force a meal choice.

---

# 18. Recipes

The application should support recipes.

Recipes can include:

- ingredients
- approximate nutrition
- serving size
- preparation instructions
- alternatives

Recipes should be useful for reaching the user's nutritional goals.

---

# 19. Workout Feature

The application includes a home-workout feature.

The user does home workouts without dumbbells.

The workout system should therefore prioritize:

- bodyweight exercises
- home-friendly exercises
- cardio
- HIIT
- mobility
- stretching
- core
- upper body
- lower body
- full body

The application should not assume gym equipment.

---

# 20. Workout Schedule

The user already has a workout routine.

The application should support a customizable weekly schedule.

Example structure:

- Monday — Upper Body
- Tuesday — Upper Body
- Wednesday — Rest
- Thursday — Lower Body
- Friday — Lower Body

The schedule must remain editable.

---

# 21. Workout Difficulty

The workout system should support multiple difficulty levels.

Difficulty can be represented as:

- beginner
- intermediate
- advanced
- custom

The user should not be forced into a particular difficulty.

---

# 22. Workout Format

Workouts can contain:

- rep-based exercises
- time-based exercises
- combined exercises

Examples:

- 10 squats
- 30-second plank
- 3 sets × 12 lunges

---

# 23. Workout Calories

The application may estimate calories burned during workouts.

Workout calories are informational.

They must not automatically increase the user's food target.

---

# 24. Daily Steps

The application does not automatically retrieve steps in V1.

Instead, near the end of the daily tracking flow, the application asks:

> "How many steps did you do today?"

The user can manually enter the number.

Example:

> 2,500 steps

This information appears in the daily summary/garden.

---

# 25. Water Tracking

The user can manually log water consumption.

The application should show:

- amount consumed
- daily progress
- optional target
- progress visualization

The UI should support the user's preferred unit system.

---

# 26. Sleep Tracking

The user can record:

- bedtime
- wake time
- sleep duration
- sleep quality
- optional notes

Sleep should be treated as a supporting wellness metric rather than a strict performance score.

---

# 27. Mood Tracking

The user can record their daily mood.

The mood system should remain simple.

Example moods:

- Great
- Good
- Okay
- Low
- Rough

Optional notes may be added.

---

# 28. Daily Summary

At the end of the day's tracking flow, the application should present a summary containing relevant information such as:

- calories
- protein
- water
- workout
- steps
- sleep
- mood
- weight
- garden progress

The summary should feel like a friendly diary reflection rather than a report card.

---

# 29. Main Screen

The first screen should feel like:

> **My Personal Nutrition Garden**

The garden should be a major part of the experience.

The user should immediately see:

- garden
- bunny
- today's progress
- important nutrition information
- relevant activity
- gentle AI guidance

The interface should not immediately overwhelm the user with statistics.

---

# 30. Garden

The garden is the emotional center of the application.

It represents the user's progress.

The garden can contain:

- flowers
- plants
- trees
- paths
- decorations
- seasonal elements
- magical details
- bunny habitat
- unlocked objects

Garden growth should be connected to positive user activity.

---

# 31. Garden Growth

The garden grows when the user completes positive actions.

Possible actions include:

- logging food
- reaching nutrition targets
- logging protein
- completing workouts
- entering steps
- logging water
- logging sleep
- logging mood
- logging weight

The garden should reward consistency.

---

# 32. No Punishment System

Missing an activity must NOT remove garden progress.

There should be:

- no negative garden points
- no punishment for missing a day
- no shame messaging
- no "you failed" state

The garden represents growth, not perfection.

---

# 33. Bunny Evolution

The bunny evolves as the garden grows.

Possible evolution can include:

- appearance changes
- accessories
- habitat improvements
- animations
- new interactions
- new expressions

The exact evolution stages are an implementation/design decision, but they should be tied to meaningful long-term progress.

---

# 34. Garden Customization

The garden should offer meaningful customization.

The user can eventually customize:

- decorations
- plants
- layout
- visual elements
- bunny environment

Customization should unlock progressively.

---

# 35. Achievements

The application should contain achievements.

Achievements should reward positive behavior.

Examples:

- first meal logged
- first workout
- first week
- consistent tracking
- garden milestone
- weight milestone
- hydration milestone

Achievements should feel celebratory rather than competitive.

---

# 36. Calendar

The application should include a calendar.

The calendar can visualize:

- workouts
- nutrition tracking
- weight
- water
- sleep
- mood
- other meaningful wellness activity

The calendar is primarily for reflection and planning.

---

# 37. Planned Workout Awareness

The AI fairy should know the user's planned workout schedule.

For example:

If today is Monday and Monday is an upper-body day, the fairy can say:

> "It's upper-body day 🌷. Your planned workout is ready whenever you are."

The fairy should not pressure the user.

---

# 38. Proactive Fairy

If the user has not eaten enough by evening, the fairy may proactively provide a gentle reminder.

Example:

> "You still have some room left in today's nutrition garden. Want a few easy meal ideas?"

The fairy must avoid repeated reminders.

---

# 39. Meal Recommendation Behavior

Meal recommendations should be personalized.

The AI can consider:

- remaining calories
- remaining protein
- previous meals
- user preferences
- meal timing
- recipes

Recommendations should not become rigid instructions.

---

# 40. AI Personality

The AI personality is:

> **AI Companion**

The fairy should feel like a helpful companion rather than a coach or medical professional.

Communication should be:

- gentle
- warm
- concise
- encouraging
- playful when appropriate

---

# 41. AI Memory

The AI should remember a limited amount of useful personal preference information.

The AI should not automatically remember everything.

Examples of useful memories:

- preferred foods
- disliked foods
- meal preferences
- recurring routines

The application should require user confirmation before storing meaningful long-term memories.

---

# 42. Health Safety

The application is a personal wellness tool.

It is not a medical diagnostic system.

The application must avoid:

- diagnosing illness
- prescribing treatment
- making medical claims
- presenting estimates as medical facts
- encouraging unsafe weight gain
- encouraging extreme restriction

---

# 43. Desktop-First

V1 is designed primarily for desktop use.

Photo-based food recognition is explicitly excluded from V1.

Future mobile functionality may be considered later.

---

# 44. V1 Non-Goals

The following are NOT required for V1:

- photo food recognition
- automatic phone step synchronization
- wearable integration
- social networking
- public profiles
- competitive leaderboards
- gym equipment tracking
- dumbbell-based workout assumptions

---

# 45. Product Success

The application succeeds if the user can comfortably:

1. Understand their calorie target.
2. Log food.
3. Track weight.
4. See weight progress.
5. Complete home workouts.
6. Track supporting wellness habits.
7. Understand daily nutrition.
8. Receive useful AI assistance.
9. See their garden grow.
10. Enjoy returning to the application.

The application should make healthy progress feel rewarding rather than restrictive.

---

# 46. Product Principle

The central product principle is:

> **The garden grows because you take care of yourself — not because you are perfect.**