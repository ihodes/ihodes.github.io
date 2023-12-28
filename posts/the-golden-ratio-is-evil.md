---
layout: post
title: The Golden Ratio is Evil
summary: Wherein I illustrate how Phidias deceived us.
categories: clojure programming math
date: 2010-08-24
---
## What is the Golden Ratio?

The Golden Ratio is a number that's been fascinating artists, mathematicians and philosophers for millennia. The fascination started with Mr. [Phidias][2] , circa 400 BCE, the sculptor involved in making the statues of the Parthenon. He considered the ratio a rule by which to craft the perfect human form, and it's after him that we know the Golden Ratio as φ, the Greek letter phi.

A few mathematicians and philosophers later, [Fibonacci][3] discovered that the ratio, from term to term, of his eponymous sequence approaches φ. Pretty cool, that.

Used in architecture, painting, drawing, and many works of adulatory prose, φ has garnered a lot of attention over the ages. But there's a darker side to φ

## Calculating the Golden Ratio

As already mentioned, the Golden Ratio can be calculated using the Fibonacci sequence. In order to do that, though, we need the Fibonacci sequence. I've decided to make a lazy version of the sequence, so we can think of it as an infinite sequence. I split my fibo into two parts: fibo-from, which gives you the entire sequence after the point you give it, and fibo, which gives you the entire sequence.

```clojure
(defn fibo-from [n-2 n-1]
  (lazy-seq
   (cons (+ n-2 n-1)
         (fibo-from n-1 (+ n-2 n-1)))))

(defn fibo []
  (concat [0 1]
          (fibo-from 0 1)))
```

Now we can continue on to deriving φ: Let's look at the first 20 ratios:

```clojure
(map (fn [[x y]] (/ y x))
     (drop 1 (partition 2 1 (take 22 (fibo)))))
```

If we map double (the function) across the ratios we get in return, we can cleary see that we're getting closer and closer to the Golden Ratio. Of course, we'll never actually reach it. On the subject of ancient Greece, you could say φ [tantalizes][4] us.

Another way of calculating our fickle ratio is with a simple continued fraction. I've generalized the simple-continued-fraction function from my [previous post on finding e][5], but the idea is the same:

```clojure
(defn generalized-continued-fraction
  "Returns the value of the GCF of the sequences of numerators
   and denominators. 'denomseq must have one more element than
   'numseq."
  [numseq denomseq]
  (let [sn (reverse numseq) sd (reverse denomseq) ]
    (loop [hn (first sn) sn (rest sn) hd (first sd) sd (rest sd)]
      (cond (empty? sd) hd
            :else (recur (first sn) (rest sn)
                         (+ (first sd) (/ hn hd)) (rest sd))))))
(defn simple-continued-fraction
  "Returns the final value of the SCF of 'sequence."
  [sequence]
  (generalized-continued-fraction
    (take (dec (count sequence)) (repeat 1)) sequence))
```

The sequence that represents the Golden Ratio is rather simple and beautiful, and also surprising if you haven't seen it before. It is `1, 1, 1, 1, . . .` and so forth. Therefore using simple-continued-fraction to find it is trivial:

```clojure
(double (simple-continued-fraction (take 1000 (repeat 1))))
=> 1.6180339…
```

## Evil Lurks

But in this seemingly beautiful number, a dark secret hides. But first we need to understand [what makes a number evil][6]. It's a simple idea, really: if the sum of the first *n* digits of the fractal part of a decimal number is 666, the number is evil.

But in order to get precise results, we need to get a precise representation of the Ratio. Here, we get to harness the power of Java! In this case, we're going to use the [BigDecimal][7] class.

```clojure
(let [n (simple-continued-fraction (take 1000 (repeat 1)))]
  (.divide (BigDecimal. (numerator n))
           (BigDecimal. (denominator n))
           200 ;; our precision
           BigDecimal/ROUND_HALF_UP))
=> 1.6180339887498948482045868343656381177203091798057628621
354486227052604628189024497072072041893911374847540880753868
917521266338622235369317931800607667263544333890865959395829
0563832266131992829026788M
```

Which looks about right.

Now we need to see about getting the digits from the fractal portion of the number. To save time, I'm going to cheat a little, and transform the result into a string and obtain the digits from that. Assume that I've stored the result of the previous calculation in the var `gold`.

```clojure
(map #(Integer. (str %))
     (drop 2 (str gold)))
=> (6 1 8 0 3 3 9 8 8 7 4 . . . ) ;; and so on
```

Now let's see how many numbers we have to take to get the [number of the beast][8]. Assume that our sequence of fractal digits found is stored in the var `goldseq`.

```clojure
(defn sum [& xs] (reduce + xs))

(loop [maybebeast (sum (take 1 goldseq)) n 1]
  (cond (= maybebeast 666) n
        :else (recur (apply sum (take (inc n) goldseq))
                     (inc n))))
=> 146
```

And there you have it, the sum of the first 146 fractal digits of φ is 666. **Verified**: φ is evil. Of course, if it had not been evil, or it had taken the sum of more than 200 fractal digits to equal 666, this wouldn't have worked. It would have been easy to test though: continue testing the sum of the first *n* digits of the number until the sum exceeds 666. (Which could fail if we continue to get zeroes. Per the halting problem, we might never know if a number is evil, depending on its fractal component. Unless we could prove something else about it. But that's another story…)

But it's not just the fact that φ reminds us of one of Hades' cruelest trials (the [trial of Tantalus][9]), or that the first 143 digits sum to 666. No, there is yet *more* evil to be found in φ. If you take the ratios of the sections of [a pentagram][10], you'll again end up with the Golden Ratio. Evil everywhere!

* * *

In all seriousness, φ is a lot of fun to play with, and that's about it. If you were serious about calculating φ properly, you'd find the positive root the quadratic equation which defines it. That equation is:

<img src="/images/goldenratio.png" width="227" height="33" />

…and solving for the positive root yields the Ratio.

Regardless, I find sequences and continued fractions a lot more interesting and conducive to play in Lisp with.

Let me leave you with this piece of advice: beware the evil [phi][11]!

[1]: http://copperthoughts.com
[2]: http://en.wikipedia.org/wiki/Phidias
[3]: http://en.wikipedia.org/wiki/Fibonacci
[4]: http://homepage.mac.com/cparada/GML/Tantalus1.html
[5]: http://copperthoughts.com/p/e-and-clojure/
[6]: http://mathworld.wolfram.com/EvilNumber.html
[7]: http://download-llnw.oracle.com/javase/6/docs/api/java/math/BigDecimal.html
[8]: http://en.wikipedia.org/wiki/Number_of_the_Beast
[9]: http://en.wikipedia.org/wiki/Tantalus#Story_of_Tantalus
[10]: http://en.wikipedia.org/wiki/Pentagram
[11]: http://en.wikipedia.org/wiki/Phi
