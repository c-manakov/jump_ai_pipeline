# Comments Overuse

## Problem

When you overuse comments or comment self-explanatory code, it can have the effect of making code *less readable*.

## Bad Example

```elixir
# Returns the Unix timestamp of 5 minutes from the current time
defp unix_five_min_from_now do
  # Get the current time
  now = DateTime.utc_now()

  # Convert it to a Unix timestamp
  unix_now = DateTime.to_unix(now, :second)

  # Add five minutes in seconds
  unix_now + (60 * 5)
end
```

## Good Example

```elixir
@five_min_in_seconds 60 * 5

defp unix_five_min_from_now do
  now = DateTime.utc_now()
  unix_now = DateTime.to_unix(now, :second)
  unix_now + @five_min_in_seconds
end
```

## Why?

Prefer clear and self-explanatory function names, module names, and variable names when possible. The function name explains well what the function does, so you likely won't need comments. The code also explains the operations well through variable names and clear function calls.

Using module attributes like `@five_min_in_seconds` serves the additional purpose of giving a name to "magic" numbers, making the code clearer and more expressive.

Elixir makes a clear distinction between **documentation** and code comments. The language has built-in first-class support for documentation through `@doc`, `@moduledoc`, and more.
