

University of
BRISTOL
Business School

# EFIMM0142: Modelling Analytics

## Week 1 (Part a): Introduction to Linear Optimisation

Dr. Marios Kremantzis, PhD, MSc, BSc, FHEA, CMBE, AFORS
[Unit Director & Lecturer]

bristol.ac.uk/business-school

---



# Learning Objectives

*By the end of this lecture, you should be able to:*

* explain what management science is;

* detail areas in business where management science is commonly used;

* describe the management science - modelling approach.

bristol.ac.uk


---



# Decisions! Decisions!

Managers' responsibility:
To make strategic, tactical, or operational decisions.

• **Strategic decisions:**
  Involve higher-level issues concerned with the overall direction of the organization.
  Define the organization's overall goals and aspirations for the future.

• **Tactical decisions:**
  Concern how the organization should achieve the goals and objectives set by its strategy.
  Are usually the responsibility of midlevel management.

• **Operational decisions:**
  Affect how the firm is run from day to day.
  Are the domain of operations managers, who are the closest to the customer.

bristol.ac.uk


---



# Making Better Decisions

[Word cloud containing management science terminology including: organisations, motivated, productivity, statistical-econometric, individuals, contributions, multi-criteria, Theoretical, Government, working, Water, interests, practical, members, models, Training, overlapping, journals, groups, DEA, indices, theory, Pensions, under, Higher, Council, results, Primary, applied, Analysis, research, brings, provides, management, field, Education, Courses, new, units, Local, staff, Aston, Funding, applicable, centre, science, Business, transitive, respected, change, cost, Utilities, performance, assessing, NHS, valid, functions, Envelopment, value, mutually, biases, CEPMMA, Data, projects, published, supervision, comparing, through, profit, development, measurement, Communities, supporting, sponsor, PhD, application, community, programming, computed, applications, efficiency, students, regularly, generally, contributed, methods, service, influences, incorporation, researchers]

• Management Science (MS) is an approach to decision making based on the **scientific** method, makes extensive use of **quantitative methods**. *(by Anderson, Sweeney, Williams)*

• Management Science is a discipline that attempts to **aid managerial decision making** by applying a scientific approach to managerial problems that involve **quantitative methods**. *(by Hillier and Hillier)*

• Management Science is the application of a scientific approach to solving management problems in order to help managers **make better decisions**. *(by Taylor)*

> Management science models become useful when common sense and intuition fail to solve the problems.

bristol.ac.uk

---



# Does Management Science Work?

* **BT** used MS approaches to plan to the work of its repair engineers, saving £125 million a year.

* **British Airways** used MS to review its spare parts policy for its aircraft fleet, saving £21 million a year.

* A **UK hospital** used MS to develop a computerized appointment system that cut patient waiting time by 50%.

* **Ford** used MS to optimize the way it designs and tests new vehicle prototypes, saving over £150 million.

* **Samsung** used MS to cut time taken to produce microchips increasing sales revenue by around £500 million.

---

Company logos displayed: Ford, BT, Samsung, British Airways, NHS

bristol.ac.uk

---



# Management Science Applications

* Assignment

* Data mining

* Logistics

* Marketing

* Financial Decision Making

* Optimisation

* Transportation

* ……

The slide includes a business analytics visualization showing various data representations including circular progress indicators displaying 86% and 62%, a world map, bar charts with an upward trend, and financial market candlestick charts, representing the data-driven nature of management science applications.

bristol.ac.uk


---



# Modelling VS Models

* This unit stresses **modelling**, not models.

* Learning specific **models** is essentially a memorization process.

* **Modelling** is a process where you abstract the essence of a real problem into a model.

* **Successful modelers** treat each problem on its own merits and model it appropriately, using all the logical, analytical, and spreadsheet skills they have.

bristol.ac.uk


---



# The 7-Step Modelling Process (I)

Houston, we have a problem

## Step 1: Problem Definition

* Typically, a management science model is initiated when an organization believes it has a **problem** and calls in the analyst to **solve it**.

* In such cases, the problem has probably already been **defined** by the client, and the client hires the analyst to solve this problem.

* The task of the analyst is to do some **investigation** before accepting the client's claim that the problem has been properly defined.

> **Defining the problem** includes specifying the **organization's objectives** and the parts of the organization that must be studied before the problem can be solved.

bristol.ac.uk


---



# The 7-Step Modelling Process (II)

## Step 2: Data Collection

• After defining the problem, the analyst collects data to estimate the **value of parameters** that affect the organization's problem.

• All organizations keep track of various data on their operations, but the data are often not in the form the analyst requires.

• One of the analyst's first jobs is to gather exactly the **right data** and put the data into an **appropriate** and **consistent format** for use in the model.

<table>
<thead>
<tr>
<th>The 4 Vs of Big Data<br>(Source: IBM)</th>
<th>Category</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td rowspan="4"></td>
<td>Volume<br><em>Data at Rest</em></td>
<td>Terabytes to exabytes of existing data to process</td>
</tr>
<tr>
<td>Velocity<br><em>Data in Motion</em></td>
<td>Streaming data, milliseconds to seconds to respond</td>
</tr>
<tr>
<td>Variety<br><em>Data in Many Forms</em></td>
<td>Structured, unstructured, text, multimedia</td>
</tr>
<tr>
<td>Veracity<br><em>Data in Doubt</em></td>
<td>Uncertainty due to data inconsistency & incompleteness, ambiguities, latency, deception, model approximations</td>
</tr>
</tbody>
</table>

bristol.ac.uk


---



# The 7-Step Modelling Process (III)

Step 3: **Model Development**

* After defining the client's problem and gathering the necessary data, the analyst must develop a model of the problem.

* Models are representations of real objects or situations

* Three forms of models are:

  ✔ **Iconic models** - physical replicas of real objects

  ✔ **Analog models** - physical in form, but do not physically resemble the object being modeled

  ✔ **Mathematical models** - represent real world problems through a system of mathematical formulas and expressions based on key assumptions, estimates, or statistical analyses (e.g., deterministic optimization models, simulation models)

bristol.ac.uk


---



# The 7-Step Modelling Process (IV)

## Step 3: **Model Development** (cont.)

Several properties are desirable for a **good model**.

* It should represent the client's real problem **accurately**.

* If the model ignores an important constraint, such as an upper bound on capacity, its recommendations might not be possible to **implement**.

* If a model ignores uncertainty when uncertainty is a key aspect of the problem, its findings won't be very **believable**.

* A good model should achieve the **right balance** between being too simple and too complex.

[A directional road sign post with two arrows pointing in opposite directions - one labeled "COMPLEX" pointing up and right, and another labeled "SIMPLE" pointing down and right]

bristol.ac.uk


---



# The 7-Step Modelling Process (V)

## Step 4: Model Verification

* The analyst now tries to determine whether the model developed in the previous step is an **accurate representation** of reality.

* The model must pass "**plausibility checks**". In this case, various input values and decision variable values are entered into the model to see whether the resulting outputs are plausible.

* If the model's outputs are **not** as expected, then the model is a poor approximation of the actual situation, or the model is fine, but the analyst's intuition is faulty.

[A rubber stamp image showing "VERIFIED" in green text on a white background, with the stamp handle visible]

bristol.ac.uk


---



# The 7-Step Modelling Process (VI)

## Step 5: Optimisation & Decision Making

Optimise

* To use the model to recommend decisions or strategies, the model has to optimize an objective, such as maximize profit or minimize cost.

* The optimization phase is typically the most difficult phase from a mathematical standpoint.

* Several solution algorithms are available to solve real problems (e.g., simplex algorithm, branch-and-bound).

* When the problem is too complex, a heuristic is used to solve it. Heuristic is guided by common sense, intuition, and trial-and-error.

bristol.ac.uk


---



# The 7-Step Modelling Process (VII)

## Step 6: Model Communication to Management

* The analyst must eventually communicate a model and its recommendations to the client.

* A large gap typically exists between management science analysts and the managers of organizations. Managers know their business, but they often do not understand much about mathematical models.

* The best strategy for a successful presentation is to involve key people in the organization, including top executives, in the project from the beginning.

* The analyst should also try to make the model as intuitive and user-friendly as possible.

The page includes an illustration showing a diverse group of business professionals sitting around a conference table in a meeting setting, with various communication and idea icons (lightbulb, speech bubbles, charts, gears) floating above them, representing the collaborative communication process between analysts and management.

bristol.ac.uk


---


# The 7-Step Modelling Process (VIII)

## Step 7: Model Implementation

* If the organization has accepted the **validity** and **usefulness** of the study, the analyst then helps to implement its recommendations.

* The implemented system must be monitored **constantly** (and updated **dynamically** as the environment changes) to ensure that the model enables the organization to **meet its objectives**.

* A useful model, once implemented, is likely to be **expanded** by the organization.

bristol.ac.uk
