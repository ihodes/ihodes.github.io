---
layout: post
title: Finding e within the randoms
summary: Wherein I find the sum of sums
categories: math
date: 2014-07-16
---

<section>

I got a message from [Omar Camarena](http://www.math.harvard.edu/~oantolin/)
about my post "[e and Clojure](/p/e-and-clojure)"; I had misstated an identity
equating e to the expectation of a random process. The (now fixed) statement (taken
from
[this site](http://www.mostlymaths.net/2010/08/and-e-appears-from-nowhere.html))
is below:

> ... the cool fact that the expected (average) number of random numbers between
> 0 and 1 needed to sum to 1 or more is, well, 2.7182… e

I was curious why this was, so I decided to tackle it. The solution offered in
the the above post takes the geometric approach of calculating the volume of the
simplex which contains the set of points which add up to some number less than
one. That simplex is the volume under the line $1-x_n - \ldots - x_1$; drawing
out the cases for 2 and 3 dimensions is a good way to visualize this. The
equation representing that area is $\int_0^\infty \int_0^{1-x_n}
(1-x_1-\dots-x_n) \, \mathrm{d}x_1 \mathrm{d}x_n$. Finding a generalization
(and, it turns out, a lovely closed-form version) of this requires induction
using Fubini's Theorem, which was more than I felt like dealing with.

So, instead, I took [Tim's](https://github.com/timodonnell) suggestion to
approach this from a probabilistic angle. We can enforce the same restrictions
we did on our integral (that all the points must add up to one or less) using
the right distributions. First, we'll need a sprinkling of xs from a uniform
distribution $X_1, \dots, X_n \sim \mathrm{Unif(0, 1)}$, and we'll need the sum of
them to be less than one, $Z = \mathrm{sum(} X_1, \dots, X_n \mathrm{)}$.
$\mathrm{P(} Z \leq 1 \mathrm{)}$ is then what we're interested in. It turns out
there's a nice distribution, called the
[Irwin-Hall distribution](http://en.wikipedia.org/wiki/Irwin%E2%80%93Hall_distribution),
which exactly models Z. Deriving the distribution is an exercise for another
night.

We're interested in $\mathrm{P(} N = n\mathrm{)} = \mathrm{P(} Z > 1; n
\mathrm{)} - \mathrm{P(} Z > 1; n - 1 \mathrm{)}$, which is the probability that
it takes exactly $n$ draws to get right past one.

From the CDF of the distribution we get $\mathrm{P(} Z \leq 1 \mathrm{)} =
\frac{1}{n!}$, so we can find what we're looking for with $\mathrm{P(} Z \gt 1
\mathrm{)} = 1 - \mathrm{P(} Z \leq 1 \mathrm{)} = 1 - \frac{1}{n!}$. From this
and the above (plus a little bit of algebra), we find $\mathrm{P(} N =
n\mathrm{)} = \frac{n-1}{n!}$. Now we merely have to use the definition of the
expectation of a random variable to find that $\sum_{n=1}^{\infty} n \cdot
\mathrm{P(} N = n \mathrm{)} = \sum_{n=1}^{\infty} \frac{n}{n!}$. It turns out
that that last sum is a definition of e.

Verifying this with a bit of Python is fun.

<figure>
```python
def fac(n): return reduce(lambda a, b: a * b, range(1, n+1), 1)

reduce(lambda a, n: a + float(n)/fac(n), range(1, 50), 0)
=> 2.7182818284590455
```
</figure>

So there you have it. e is, in fact, the expected number of draws from our pool
of uniform 0&mdash;1 until we hit or pass 1. The world is a saner place, and now
I can sleep.

</section>
