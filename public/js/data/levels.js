import { TASKS } from "./tasks.js";

// 30 solo levels, easy → hard. Every level has a fixed output, so it works in any language.
const by = Object.fromEntries(TASKS.map((t) => [t.topic, t]));
const ORDER = [
  "Hello World",
  "Uppercase",
  "Reverse a string",
  "Sum 1 to N",
  "Countdown",
  "Even or odd",
  "Power of two",
  "Celsius to Fahrenheit",
  "Find the maximum",
  "Average",
  "Count words",
  "Sum of digits",
  "Multiplication table",
  "Sort numbers",
  "Factorial",
  "Count vowels",
  "Star triangle",
  "Binary",
  "Leap year",
  "Palindrome check",
  "GCD",
  "Fibonacci",
  "FizzBuzz",
  "Prime numbers",
];
const EXTRA = [
  {
    topic: "Sum of evens",
    task: "Print the sum of all even numbers from 1 to 20.",
    expect: "110",
  },
  {
    topic: "Vowel hunt",
    task: 'Count the vowels (a, e, i, o, u) in "battle coder" and print the number.',
    expect: "4",
  },
  {
    topic: "Big factorial",
    task: "Print the factorial of 10.",
    expect: "3628800",
  },
  {
    topic: "Collatz steps",
    task: "Start at 6. If the number is even, divide it by 2; otherwise multiply it by 3 and add 1. Print how many steps it takes to reach 1.",
    expect: "8",
  },
  {
    topic: "Prime counter",
    task: "Print how many prime numbers there are up to 50.",
    expect: "15",
  },
  {
    topic: "Boss: prime sum",
    task: "Print the sum of the first 10 prime numbers.",
    expect: "129",
  },
];
export const LEVELS = [...ORDER.map((n) => by[n]), ...EXTRA];
