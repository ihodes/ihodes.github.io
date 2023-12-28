---
layout: post
title: The Clojureist’s Guide to Java
summary: Wherein I attempt to elucidate, for a Clojurist, the use of Java.
categories: clojure programming
date: 2010-08-22
---

Judging from the buzz on Twitter, the mailing list, Hacker News and other places where this kind of buzz occurs, Clojure's popularity is rapidly growing. The thing is, according to [Chas Emerick's State of Clojure][1] published earlier this summer, most of the people coming to Clojure don't have much experience with Java. This would be fine but, sooner or later, you'll think you need Java. How often you actually do to use Java is debatable; most of the time, something basic you find yourself needing may very well be in clojure.contrib or on Github, but chances are you'll be recommended a Java library or two to accomplish a task you may not know how to in Clojure. And that's okay.

Using Java from Clojure is actually pretty painless, contrary to what people who haven't tried doing it say, but first you need to have at least a *basic* grasp on how to use Java. If you've had any experience with another object oriented language, then getting started with Java is just a matter of pulling up your sleeves and searching through the JavaDocs for what you need. Of course, you may need a refresher too. And using Java from Clojure can be a *little* strange at first.

This guide doesn't aim to comprehensively cover all the ways to use Java from Clojure, nor does it attempt to explain the intricacies of Java the language or the JVM. Rather, it should serve as a "Getting Started with Java from Clojure" guide that will hopefully enable you to more easily navigate the Java documentation and use Java in your Clojure projects when the need arises. One of the nice things about Clojure is that you don't really need to know Java to use it from Clojure.

So, without further ado:


# A Clojurist's Guide to Java

## Classes

A class is a bundle of methods (functions which act on the class) that can serve as a data type. For example, to create a new class of the type Double: (Double. 1.2) which initializes the class Double (the period after the class name is syntactic sugar for calling the class constructor methods, which initialize the class with the values you provide) with the value 1.2. (Note that we don't have to import or qualify the Double class as it's a part of `java.lang`, which is included by default in your namespace.)

Now, look at the [Double's constructor documentation][2] in the Java 6 API:

    Double

    public Double(double value)

    Constructs a newly allocated Double object that represents
    the primitive double argument.

    Parameters:
    value - the value to be represented by the Double.


So you can see what happened there. You "built" a new Double with value 1.2, which is a double (the primitive). A little confusing there, but really a Double is a class that represents a double and allows you to do things relating to doubles with its methods.

## Static Methods

For instance, to parse a Double value out of a string, we can use the static method (meaning we don't need a particular instance of Double, we can just call it like we called sqrt from the Math class) parseDouble(String s):

```clojure
(Double/parseDouble "1.2") => 1.2
```

Nothing too tricky there. Notice how the argument of the method is a String, so we pass a string as an argument to the method.

## Nonstatic Methods

Say we want to use a Java class that we initialized to something. Not too difficult:

```clojure
(-> (String. "Hey there") ;; make a new String object
    (.toUpperCase))       ;; pass it to .toUpperCase (look up -> to see what it does)
                           ;; toUpperCase is a non-static method
=> "HEY THERE"
```

So now we've used a method which is not static, and which requires a real, live String object to deal with. Let's look at how the docs say it works:

    toUpperCase

    public String toUpperCase()

    Converts all of the characters in this String to upper case
    using the rules of the default locale. This method is
    equivalent to toUpperCase(Locale.getDefault()).

    Returns:
    the String, converted to uppercase.


So here we have a method which returns a string (as shown by the "String" after the public in the definition, and takes no parameters. But wait! It does take a parameter. In Python, it'd be the implicit parameter self: this is called this in Java. We could also use the method like this: (.toUpper (String. "Hey there")) and get the same result.

## More on Methods

Since you deal with mutable data and classes in Java, you need to be able to apply functions to classes (instances of classes, really) and not expect a return value.

For instance, say we're dealing with a JFrame from the `javax.swing` library. We might need to do a number of things to it, not with it (you generally operate *with* values, not *on* them in functional languages). We can, like this:

```clojure
(doto (JFrame. "My Frame!");; clever name
      (.setContentPane ... here we'd add a JPanel or something to the JFrame)
      (.pack) ;; this simply arranges the stuff in the frame
      (.setVisibleTrue)) ;; this makes the Frame visible
```

`doto` just passes its first argument to all the other functions you supply it, and passes it as the first argument to them. So here we're just doing a lot of things to the JFrame that don't return anything in particular. All these methods are listed as methods of the JFrame in the documentation (or its superclasses don't worry about those yet).

Alternatively, we could do something like this:

```clojure
(def frame (JFrame. "I'm a Frame!"))
(do ;; do just evaluates everything in its body, in order
      ;; and returns the value of the final expression
    (.pack frame) ;; = frame.pack(); in Java
    (. setVisible frame true)0 ;; = frame.setVisible(true);
```

## Notes

A few useful functions you should be aware of when playing with Java in Clojure:

*   `(class thething)` ;; returns the class name of thething; useful to see what you're actually operating on.
*   `->` and `->>` ;; threading macros; check out their documentation, along with doto
*   `(instance? AClass thething)` ;; true if thething is an instance of AClass

* * *

## Wrapping up

You should now be prepared to explore the [JavaDocs][2] yourself. Here you'll find everything that is available to you in a standard Java 1.6 install. There will be new concepts, but a quick Google search should answer most of your questions, and you can always come back here with specific ones.

Be sure to look into the other important Clojure functions like proxy and reify as well as extend-type and its friends. I don't often use them, but when I need to, they can be invaluable. I still am understanding them myself, in fact. There's a ton out there, but it's mostly a problem of volume rather than complexity. It's not a bad problem to have.

### Additional reading:

*   [Static or Nonstatic?][3] ;; a guide to static vs. nonstatic methods
*   [The Java Class Library][4] ;; an overview of what's out there, with a nice picture
*   [The JavaDocs][2] ;; linked above
*   [Clojure Java Interop Docs][5] ;; from the Clojure website
*   [Best Java Books][6] ;; as per clartaq's answer on StackOverflow

 [1]: http://cemerick.com/2010/06/07/results-from-the-state-of-clojure-summer-2010-survey/
 [2]: http://download-llnw.oracle.com/javase/6/docs/api/
 [3]: http://cscie160-distance.com/nonstatic.html
 [4]: http://en.wikipedia.org/wiki/Java_Class_Library
 [5]: http://clojure.org/java_interop
 [6]: http://stackoverflow.com/questions/75102/best-java-book-you-have-read-so-far
