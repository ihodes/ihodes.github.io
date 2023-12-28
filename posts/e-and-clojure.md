---
layout: post
title: e and Clojure
summary: Wherein I discuss and calculate Euler's Number, e.
categories: clojure programming math
date: 2010-08-20
---

A few articles made the rounds a number of weeks ago, all talking about computing Euler's Number, e, using Clojure. It wasn't until I saw the idea on [Programming Praxis][2], though, that I decided to just do it.

It's honestly a trivial problem; in fact, here's a little solution right up front:

```clojure
(defn to-one []
  (loop [times 0 sum 0]
    (cond
      (> sum 1) times
      :else (recur (inc times) (+ sum (rand))))))

(defn to-one-avg
  [n]
  (/ (reduce + (repeatedly n to-one))
      n 1.0))
```

    user> (time (to-one-avg 100000000))

    "Elapsed time: 59539.291 msecs"
    2.7182 5238

Error as compared to Math/E: 0.000067438. Not great.

That's a solution based off of the cool fact that the expected (average) number of random numbers between 0 and 1 needed to sum to 1 or more is, well, 2.7182… e. (See [this blog post][3] for a little explanation.) The problem is, it takes a lot of time to get an only moderately accurate answer. Even doing it in C results in less than stellar results, and still sluggish performance:

See it in [a Gist][4], as it takes up too much room.

    ihodes@Machine:~/Desktop
    >> time ./efinder 100000000

    Our estimate for e is 2.7182752500.
    Total time: 0m12.386s

That's not so hot. There has got to be a better way.

* * *

An alternative for finding e can be represented nicely as the sum of a sequence:

<img src="/images/sumfore.png" alt="sumfore" width="92" height="100" />

And it can be repreented just as nicely in Clojure! My sigma and factorial (fact) functions are not standard in Clojure, but they're both quite straightforward. Not only is it a pretty solution, but it's quite fast, and is just as accurate as our built-in Math/E.

```clojure
(defn sigma
  "Sum of 'f across the range 's to 'e, inclusive."
  [s e f]
  (reduce + (map f (range s (inc e)))))

(defn fact
  "Returns the factorial of 'n."
  [n]
  (reduce * (range 1 (inc n))))
```

    user> (time (double (sigma 0 100 #(/ 1 (fact %)))))
    "Elapsed time: 7.998 msecs"
    2.718281828459045

Error as compared to Math/E: 4.440892098e-16. Not bad.

But we've barely scratched the surface of how much of e is possible to calculate, and how quickly.

* * *

Yet another method for finding e involves continued fractions. Lucky for us, the continued fractions involved are simple. No, really, [that's what they're called][5]. The one we're after looks like this:

<img src="/images/continuedefrac.png" alt="continuedefrac" width="300" height="129" />

One thing to notice is that we can represent that continued fraction as a sequence. The the numerators are always 1, so we just need a list of the integer part of the denominators. In this case, [1 0 1 1 2 1 1 4 1 1 6 1 1 8 1 1 … ]. That's fun enough to build in Clojure:

```clojure
(defn efracs
  [n]
  (cons 1 (interleave
                (filter even? (range n))
                (repeat 1) (repeat 1))))
```

The trick becomes using this sequence build our continued fraction and calculate e. What first comes to mind is writing a recursive function that would destroy our stack. But instead of building it from the top down, let's think backwards. Let's instead construct our continued fraction from the bottom up, and end up at our final answer with a well-behaved stack.

```clojure
(defn simple-continued-fraction
  "Returns the final value of the SCF of 'coll."
  [coll]
  (let [coll (reverse coll)]
    (loop [coll (rest coll) h (first coll)]
      (cond (= 1 (count coll)) (+ (first coll) (/ h))
            :else (recur (rest coll) (+ (first coll) (/ h)))))))

(time (simple-continued-fraction (efracs 30)))
```

    "Elapsed time: 0.986 msecs"
    2.718281828459045

Scrumtralescent.

* * *

Now, I hate to break it to you, but these are not the methods used to calculate e to 1e18 digits. You can't even store that many digits in RAM; instead, you need to calculate e digit by digit, and write each digit to a file on your hard drive.

There's a particular program called PiFast33 that was written by Xavier Gordon around the year 2000. That program, or variants of it, is what is being used to calculate e with such great precision. According to [this site][6], which appears to be connected to Gordon in some fashion, PiFast33 uses the alternating version of the series described above to calculate e. The error shrinks rapidly, allowing the digits of e to be verified and written to the storage file quickly and efficiently.

It looks like an interesting program to try to write; maybe I'll get the chance to hack it up and post about it soon.


 [1]: http://copperthoughts.com
 [2]: http://programmingpraxis.com/2010/08/13/e/
 [3]: http://www.mostlymaths.net/2010/08/and-e-appears-from-nowhere.html
 [4]: http://gist.github.com/539670
 [5]: http://en.wikipedia.org/wiki/Simple_continued_fraction
 [6]: http://numbers.computation.free.fr/Constants/E/e.html#eSeries
