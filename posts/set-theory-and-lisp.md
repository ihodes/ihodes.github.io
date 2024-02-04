---
layout: post
title: Set Theory and Lisp
summary: Wherein I draw parallels between Lisp and Set Theory.
categories: programming math
date: 2010-09-01
---

<section>
A few weeks ago a provoking question was posted on StackOverflow asking if, for example, Common-Lisp's `numberp` could be written using only the primitives that John McCarthy presented in [his now famous essay introducing LISP](http://www-formal.stanford.edu/jmc/recursive.html).

<p>My answer was yes, but it wasn't the kind of yes you might expect. In his essay, McCarthy did not even mention numbers. There are no primitives to deal with them; only primitives to construct and deconstruct lists (i.e `car`, `cdr`, `cons`), as well as a few to enable the creation and naming of functions (i.e. `lambda`, `label`). But there are no number primitives: no direct interaction with the ALU, no way to directly access and manipulate integers and floats. So we have figure something else out.</p>
</section>

## It's All Lists From Here

So how *can* you represent numbers?

I'm going to eschew using the troublesome *cons* cell in my explanations. Instead, we'll use the more common list notation that's both easier to explain and easier to write. Of course, I'll be using the `cons` function (how could I *not*?) and you should at least have [an idea of how that works](http://en.wikipedia.org/wiki/Cons).

It turns out that there are a number of ways to represent the natural numbers. Paul Graham postulates one way of representing them [in his essay *The Roots of Lisp*](http://www.paulgraham.com/rootsoflisp.html). I'll state here, slightly tidied up, his suggestion:

* Let the empty list be zero.
* Let 1 = `(cons 0 ())`
* Let 2 = `(cons 1 ())`
* etc.

In this way we can represent all the natural numbers. It'd be trivial to write a function `number?` that would test to see if if its argument had the form of a number. There are a number (hah!) of things we could do with this representation, but I think we can do better.

**Edit**: [Phil Hagelberg](http://technomancy.us/) reminds me of another, very important, representation of the natural numbers I'd be remiss to leave out: the [Church Encoding](http://en.wikipedia.org/wiki/Church_encoding). Church Encoding is way of representing the natural numbers using only lambda calculus: there are no lists involved. Instead, a number *n* is representing by a higher order lambda abstraction (a function), and returns the result of that function being composed with itself *n* times. There's actually a fair amount that can be done with this representation, but it's outside the scope of this essay. For the curious, the afore-linked Wikipedia article does a fine job of covering the basics.

## The More Lists, the Merrier

But really, that's not enough lists, is it?  `(((((((((())))))))))` is not nearly an unwieldy enough definition for 10. We need more lists.

Let's take a step back and look at set theory; a branch of math and CS that's informed a lot of underpinning of CS and programming in general. Set theory has already provided us with a handy way of defining numbers based on lists. Well not lists, *sets*, but sets are basically lists. In fact, contrary to popular/programming belief, sets can hold the same thing multiple times, but in set theory that means nothing. We'll say the same thing about lists: "when you say my list *a* contains *b* and *b*, I just hear that *b* is in *a*".

So how do we represent numbers using only sets? Well, we start with the empty set `{}` being zero. But, and here's where things get weird, we now define a function *S* called the "successor function". The successor of *n* is the union of *n* and the set of *n*, where `union` is a function of *n* and *m* that returns the set which contains all the elements in *n* and all the elements in *m*.  *S(n) = {n and all the elements in n}*. To make this clearer, let's look at a few examples.

    S(0) = union(0 {0}) = {0} ;; we'll call this 1
    S(1) = union(1 {1}) = union({0} {{0}})
           = {0 {0}} ;; and this 2
    S(2) = {0 1 2}  ;; 3
    S(3) = {0 1 2 3} ;; 4

At the very least, this is an interesting definition of the natural numbers. The predecessors of each number are contained within it. And the set of *all* the natural numbers has a form similar to an individual natural number. Neat.

Let's see how we can represent this with lists. Our goal is a function, *S*, that returns the successor of a given list.

```scheme
    (define S
      (lambda (n)
        (union n (cons n ()))))
```

Perfect, though we don't exactly have a union function yet:

```scheme
    (define union
      (lambda (n m)
        (cond ((null? n) m)
               (else (cons (car n)
                           (union (cdr n) m))))))
```

Now we do. You can test it out in your own REPL, or online with [TryScheme](http://tryscheme.sourceforge.net/). We're going to move on now.

## So What?

Thats a valid question. At this point, it seems as though we've merely complicated Mr. Graham's elegant and simple proposition. It turns out that we've actually made things easier, in the long run.

Before we even get to addition and the like, let's look at one example of where we've made things easier and more elegant. Let's look at an ordering on the natural numbers; `<`. With this definition, we don't need anything else to define it: *n* < *m* if (and only if) *n* is in *m*. That's a straight forward definition, and one we can check rather quickly with a Lisp function you might have on hand anyway ([*The Little Schemer*](http://www.amazon.com/Little-Schemer-Daniel-P-Friedman/dp/0262560992#reader_0262560992) calls it `member?`).

But first we need a better `eq?`. The current `eq?` operates only on atoms; we need an `equal?` that works on our list representation of numbers. To keep things simple, we're going to assume our lists are ordered. That will be the case if we build our numbers with just *S*.

```scheme
    (define equal?
      (lambda (n m)
        (cond ((and (null? n) (null? m)) #t)
              ((or (null? n) (null? m)) #f)
              (else (and (equal? (car n) (car m))
                         (equal? (cdr n) (cdr m)))))))

    (define member?
      (lambda (a l)
        (cond ((null? l) #f)
              (equal? a (car l)) #t)
              (else (member? a (cdr l))))))

    (define <
        (lambda (n m)
           (member? n m)))
```

This works because all our natural numbers are either the empty list or a list of natural numbers, thanks to our nicely defined *S* function.

It turns out that this successor function is also nice for defining and working with ideas like ordinals and cardinals, and just generally makes out theorems easier to prove and reason about. But, without writing a book on it, suffice it to say there's a certain elegance about it. I'll leave it at that.

## In Addition…

But back to our problem: numbers on a simple Lisp machine. We've now got a suitable representation of the natural numbers (though I've neglected to introduce the axioms required to fully justify this; let's just use common sense and carry on), and we have a way of comparing two numbers.

We also have a way of adding one to a number in *S*. How about adding two natural numbers together?

```scheme
    (define zero?
      (lambda (n)
        (equal? () n)))

    (define A
      (lambda (n m)
        (cond ((zero? m) n)
              (else (S (A n (P m)))))))
```

That is a nice recursive definition, but we have a mysterious new *P* function now, as well. *P* stands for "predecessor", and it gives us the natural number than *m* is a successor of.

Before defining *P*, let me present the set theoretical definition of addition:

* *A(n, 0) = n*
* *A(n, S(m)) = S(A(n, m))*

This is also recursive, but it has the unfair advantage of what the Clojurist in me calls the "de-structuring" of its operands. *A* can check to see if its second operand is a successor, and if it is will take the successor of the result of another *A*'s value.

With Lisp, we can check to see is *m* is zero, and if it isn't, we know that it is a successor, we just don't know what it is a successor *of*. That is where *P* comes in.

```scheme
    (define R
      (lambda (fn acc l)
         (cond ((null? l) acc)
               (else (R fn (fn acc (car l)) (cdr l))))))

    (define P
      (lambda (n)
        (cond ((zero? n) #f) ;; really, undefined
              (else (R union () n)))))
```

And out of nowhere comes a higher-order function! While set theory may have some expressive advantages over Lisp, we've got some special sauce, too. In this case `(R union () n)` is equivalent to the set theoretical "union over a set" that the [Zermelo-Fraenkel](http://en.wikipedia.org/wiki/Zermelo-Fraenkel_set_theory) Union Axiom gives provides. Most people call *R* "reduce".

You might notice that we get duplicates in our lists, but as I said before, we don't pay those any attention. To keep things clean and  working well, we'll implicitly apply a helper function, `distinct`, to the result of every operation. `distinct` is left as an exercise to the reader; but this is a very important exercise: some of our function will *not* work if `distinct` isn't applied to the result of each function.

With a proper *P* defined, *A* now works flawlessly. Now let's define *M*, multiplication and *B*, subtraction:

```scheme
    (define M
      (lambda (n m)
        (cond ((zero? m) ())
              (else (A n (M n (P m)))))))

    (define B
      (lambda (n m)
        (cond ((zero? m) n)
              (else (P (B n (P m)))))))
```

It gets easier and easier as we build off of our previous functions, and combine them to yield more complex, more useful abstractions. Finally, let's write our number predicate;

```scheme
    (define length
      (lambda (n)
        (cond ((null? n) ())
              (else (S (length (cdr n)))))))

    (define number?
      (lambda (n)
        (equal? n (length n))))
```

And there you have it; we've got the basics of our natural numbers, represented using McCarthy's basic LISP.

## But, Wait! There's More

Ah, we've left off the integers. And floats!

Fortunately, this isn't a big deal. With our newly defined natural numbers, we can represent integers as a tuple of natural numbers, where the first natural number in the tuple represents the "negative" portion of the integer, and the second natural number represents the "positive" portion of the integer.

In this manner we can represent all the integers. Of course, we'll have to create new functions for adding, subtracting and the like, but that becomes a matter of building new, higher level abstractions with our existing functions.

For example, we can define adding two integers like this:

```scheme
    (define first
      (lambda (n)
        (car n)))

    (define second
      (lambda (n)
        (car (cdr n))))

    (define makeint
      (lambda (n p)
        (cons n (cons p ()))))

    (define A2
      (lambda (x y)
         (makeint (A (first x) (first y))
                  (A (second x) (second y)))))
```

Something important to keep in mind, however, is that different tuples can represent the same integer. For instance, the integer (2, 5) is the same as the integer (0, 3); they're both what we would have called "3" back in the natural numbers section. In fact, it makes sense to call both of them "3" here. But the second example here is preferable, I'd say. This is something that is dealt with in set theory by [equivalence relations](http://en.wikipedia.org/wiki/Equivalence_relation); we can do the same thing in Lisp. Below I'll define a function which returns the "simplest" version of a given integer; one where either the negative portion is zero, the positive portion is zero, or they are both zero.

```scheme
    (define simplint
      (lambda (z)
        (cond ((or (zero? (first z)) (zero? (second z))) z)
              (else (makeint (P (first z))
                             (P (second z)))))))
```

Subtraction, multiplication and other operations on integers begin to fall into place with these definitions. Things don't get more complicated as you move further away from your base representation (unless you try to formally prove all of my assertions): if anything, they get easier. This is a consequence of appropriate abstraction.

So far, we have arbitrarily large integers available to us (limited in practice only by memory and processing power). But we're still missing a type of number most programmers expect to have available to them: the float. Well, we can do that too.

First, let's make sure we know what a float can and cannot represent. Floats can't represent all real numbers: that is to say, every float is representable by a ratio of two numbers. In fact, traditional floats can't even represent all rationals: for instance, 1/3 is 0.333… repeating forever. We would run out of bits to represent it on a real computer. But we can represent all numbers a float can, and more, with ratios. And, as I'm sure has now become clear, we definitely have ratios in the form of a tuple of integers, the first representing the numerator and the second the denominator. These are the rational numbers.

Again, an equivalence relation on the rationals is called for, as are new operations. This time, though, they are left as an exercise for the reader.

## Final Words

Though a lot more can be said about the intersection of set theory and Lisp, I'll stop while this post is still of Internet-length. If there's enough interest (mostly on my part), perhaps this will be extended into a series of essay on the subject, mirroring the progression of a elementary set theory book.

This essay is a product of my investigation into the possibility of a truly programmable and reprogrammable Lisp environment, one in which such a definition of the natural, integer and rational numbers would not only be feasible and efficient, but idiomatic. I'm a long way from explaining how such a system would work, but I thought I should record at least some of the byproducts of my thought process so that someone might obtain some value from my mental wanderings.

* * *

I should note that while I used the operators `and` and `or`, neither were in McCarthy's original LISP. Consider `(and a b)` a stand-in for `(cond (a b) (else #f))` and `(or a b)` for `(cond (a #t) (else b))`, and all is well.

If there are errors in my explanations or code samples, please let me know. I certainly simplified much of the content so that it could fit in about 2000 words, but it should be correct.
