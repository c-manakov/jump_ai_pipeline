# Complex Extractions in Clauses

## Problem

When we use multi-clause functions, it is possible to extract values in the clauses for further usage and for pattern matching/guard checking. This extraction itself does not represent an anti-pattern, but when you have *extractions made across several clauses and several arguments of the same function*, it becomes hard to know which extracted parts are used for pattern/guards and what is used only inside the function body.

## Bad Example

```elixir
def drive(%User{name: name, age: age}) when age >= 18 do
  "#{name} can drive"
end

def drive(%User{name: name, age: age}) when age < 18 do
  "#{name} cannot drive"
end
```

While the example above is small and does not constitute an anti-pattern, it is an example of mixed extraction and pattern matching. A situation where `drive/1` was more complex, having many more clauses, arguments, and extractions, would make it hard to know at a glance which variables are used for pattern/guards and which ones are not.

## Good Example

```elixir
def drive(%User{age: age} = user) when age >= 18 do
  %User{name: name} = user
  "#{name} can drive"
end

def drive(%User{age: age} = user) when age < 18 do
  %User{name: name} = user
  "#{name} cannot drive"
end
```

## Why?

A possible solution to this anti-pattern is to extract only pattern/guard related variables in the signature once you have many arguments or multiple clauses. This makes it clearer which variables are used for pattern matching and guards, and which ones are used only in the function body.
