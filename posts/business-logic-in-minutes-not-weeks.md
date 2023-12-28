---
layout: post
title: Build Business Logic in Minutes, Not Weeks
summary: Wherein I discuss networked state machines.
categories: marion-tech architecture
date: 2013-10-24
---

Many backend systems, while difficult and expensive to construct, are very similar to one another in a fundamental way; they manage state, over time, as it responds to external events.

By creating a framework that models these as "networked state machines" which are easy to create and to edit, it makes it simple to build a backend suitable for launching a simple courier service in minutes, not weeks.


---

### For example… 

[Task Rabbit](https://www.taskrabbit.com/) connects customers who need to have something done to couriers who will do it. Customers and couriers are connected by requests describing what needs to be done.

![architecture](/images/task-rabbit-arch.png)

Requests can be in exactly one of four states:

1. **Pending Response** when they are just created by a customer
2. **In Progress** when a courier accepts the task
3. **Pending Acceptance** when a courier submits the task for inspection
4. **Completed** when the customer is satisfied

This can easily be modeled by a state machine (see below). Note that couriers may drop a request in progress, which sets the state of the request back to pending, for another courier to pick up. Customers may also reject a submitted request, in effect saying that the courier has more to do. Additional states may be necessary for other features, but these four should get the job done.

The state machine might look like this, with the initial state, **Pending Response** outlined.

![request state machine](/images/request-fsm.png)

This state machine is the central piece of business logic to a Task Rabbit-like service. When a customer creates a request, they are in effect creating an instance of this state machine. A list of state machines which are in the Pending Response state (and in a certain location!) can be watched by all the active couriers (via some sort of app). When a courier accepts a request, a message is sent to the state machine, and the machine sends a text to the customer in response.

At this point, the machine looks like this:

![request accepted](/images/request-fsm-instance.png)

And has sent a text message, right away:

![request accepted text](/images/request-confirmed-text-message-ss.png)

Each action the courier or the customer takes advances the state machine which triggers other actions on other services (text messages, push notifications, email, storing records, triggering billing; whatever you can imagine). In addition, these machines can maintain an internal state as well, acting as records in a database which you can query for whatever purpose.

All of this functionality is described by a few lines of JSON (or constructed via a simple GUI interface; drag and drop states, and connect them with transition arrows), below, and hosted on Marion Technologies' platform right now. The images you saw above are live; you can watch as the individual state machines in your application progress,  interact & modify them on the fly, and analyze them. They can communicate with and create other state machines. Use them for constructing APIs; for coordinating client applications; for storing and processing evented information.

---

In this system, the only code you need to write is for the client applications (web or iOS or Android) which communicates with these machines via a simple API, and a login system to track your users and assign them an authentication key allowing them to create their requests via the API.

Even billing could be handled by a separate networked machine, one for each customer, that tracks requests made and bills the user on a monthly basis.

The key point is; you're not writing code for business logic. You just need to connect your users' clients to the networked machines you've defined. We host them, we maintain them, we even handle the external services like Stripe for billing, Twilio for texting, Mailgun for emailing, Mixpanel for analytics. You just need to describe what should happen; our machines handle the details.


##### The JSON Describing a Request

```json
{
    "name": "Request",
    "initialStateName": "Pending Response",
    "states": [
        {
            "name": "Pending Response",
            "actions": {
                "event": [
                    [["if", "eq", "acceptRequest"],
                     ["text", ".customerCell", "Your request has been accepted!"],
                     "In Progress"]]
            }
        },
        {
            "name": "In Progress",
            "actions": {
                "event": [
                    [["if", "eq", "decline"], "Pending Response"],
                    [["if", "eq", "submit"],
                     ["text", ".customerCell", "Your request has been submitted!"],
                     "Pending Acceptance"]]
            }
        },
        {
            "name": "Pending Acceptance",
            "actions": {
                "event": [
                    [["if", "eq", "acceptSubmission"], ["set", "rating", "..rating"],
                     ["text", ".courierCell", "Your submission has been accepted"],
                     "Completed"],
                    [["if", "eq", "rejectSubmission"], ["set", "rejectReason", "..reason"],
                     ["text", ".courierCell", "Your submission has been rejected"],
                     "In Progress"]]
            }
        },
        {
            "name": "Completed"
        }]
}
```

---

Thanks to Jamie Quint, Raja Hamid, and Ben Gundersen for reading over drafts and offering some much appreciated advice.
