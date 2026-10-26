const fizz = Array.from({ length: 15 }, (_, i) => {
  const n = i + 1;
  return n % 15 === 0
    ? "FizzBuzz"
    : n % 3 === 0
      ? "Fizz"
      : n % 5 === 0
        ? "Buzz"
        : String(n);
}).join("\n");

const lines = (a) => a.join("\n");
const table = lines([1, 2, 3, 4, 5].map((i) => `7 x ${i} = ${7 * i}`));

// every task has a fixed output, so any language can be checked the same way
export const TASKS = [
  {
    topic: "Hello World",
    task: "Print exactly: Hello, World!",
    expect: "Hello, World!",
  },
  {
    topic: "FizzBuzz",
    task: "Print 1 to 15, one per line. Multiples of 3 → Fizz, of 5 → Buzz, of both → FizzBuzz.",
    expect: fizz,
  },
  {
    topic: "Palindrome check",
    task: 'Check the words "level" and "hello". Print yes or no for each, one per line.',
    expect: "yes\nno",
  },
  {
    topic: "Prime numbers",
    task: "Print all prime numbers up to 30, one per line.",
    expect: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29].join("\n"),
  },
  {
    topic: "Reverse a string",
    task: 'Reverse the string "battle" and print it.',
    expect: "elttab",
  },
  { topic: "Factorial", task: "Print the factorial of 6.", expect: "720" },
  {
    topic: "Count vowels",
    task: 'Count the vowels (a, e, i, o, u) in "programming" and print the number.',
    expect: "3",
  },
  {
    topic: "Fibonacci",
    task: "Print the first 10 Fibonacci numbers starting from 0, one per line.",
    expect: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34].join("\n"),
  },
  {
    topic: "Sum 1 to N",
    task: "Print the sum of the numbers from 1 to 100.",
    expect: "5050",
  },
  {
    topic: "Even or odd",
    task: "For the numbers 1 to 5, print odd or even, one per line.",
    expect: "odd\neven\nodd\neven\nodd",
  },
  {
    topic: "Sum of digits",
    task: "Print the sum of the digits of 12345.",
    expect: "15",
  },
  {
    topic: "Find the maximum",
    task: "Given the numbers 3, 9, 2, 7, print the largest.",
    expect: "9",
  },
  {
    topic: "Countdown",
    task: "Print 10 down to 1, one per line, then print Liftoff!",
    expect: lines([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, "Liftoff!"]),
  },
  {
    topic: "Multiplication table",
    task: "Print the first 5 lines of the 7 times table, like: 7 x 1 = 7",
    expect: table,
  },
  {
    topic: "Power of two",
    task: "Print 2 to the power of 10.",
    expect: "1024",
  },
  {
    topic: "Celsius to Fahrenheit",
    task: "Convert 100 °C to Fahrenheit (F = C × 9 / 5 + 32) and print the number.",
    expect: "212",
  },
  {
    topic: "Leap year",
    task: "For 1900, 2000 and 2024 print yes if it is a leap year, otherwise no (one per line).",
    expect: "no\nyes\nyes",
  },
  {
    topic: "Count words",
    task: 'Count the words in "the quick brown fox jumps" and print the number.',
    expect: "5",
  },
  {
    topic: "Uppercase",
    task: 'Print "battle coder" in UPPERCASE.',
    expect: "BATTLE CODER",
  },
  {
    topic: "GCD",
    task: "Print the greatest common divisor of 48 and 18.",
    expect: "6",
  },
  { topic: "Binary", task: "Print the number 10 in binary.", expect: "1010" },
  {
    topic: "Star triangle",
    task: "Print a triangle of * with 4 rows (1 star, then 2, 3, 4).",
    expect: "*\n**\n***\n****",
  },
  {
    topic: "Sort numbers",
    task: "Sort 5, 2, 9, 1 from smallest to largest and print one per line.",
    expect: "1\n2\n5\n9",
  },
  {
    topic: "Average",
    task: "Print the average of 10, 20, 30, 40.",
    expect: "25",
  },
];
