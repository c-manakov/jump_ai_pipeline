# Long Parameter List

## Problem

In a functional language like Elixir, functions tend to explicitly receive all inputs and return all relevant outputs, instead of relying on mutations or side-effects. As functions grow in complexity, the amount of arguments (parameters) they need to work with may grow, to a point where the function's interface becomes confusing and prone to errors during use.

## Bad Example

```elixir
defmodule Library do
  # Too many parameters that can be grouped!
  def loan(user_name, email, password, user_alias, book_title, book_ed) do
    # ...
  end
end
```

## Good Example

```elixir
defmodule Library do
  def loan(%{name: name, email: email, password: password, alias: alias} = user, %{title: title, ed: ed} = book) do
    # ...
  end
end
```

## Why?

To address this anti-pattern, related arguments can be grouped using key-value data structures, such as maps, structs, or even keyword lists in the case of optional arguments. This effectively reduces the number of arguments and the key-value data structures adds clarity to the caller.

In some cases, a function with too many arguments may suggest the function is trying to do too much and would be better broken into multiple functions, each responsible for a smaller piece of the overall responsibility.
