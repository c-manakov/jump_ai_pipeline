# Non-Assertive Pattern Matching

## Problem

Overall, Elixir systems are composed of many supervised processes, so the effects of an error are localized to a single process, and don't propagate to the entire application. A supervisor detects the failing process, reports it, and possibly restarts it.

This anti-pattern arises when developers write defensive or imprecise code, capable of returning incorrect values which were not planned for, instead of programming in an assertive style through pattern matching and guards.

## Bad Example

```elixir
defmodule Extract do
  def get_value(string, desired_key) do
    parts = String.split(string, "&")

    Enum.find_value(parts, fn pair ->
      key_value = String.split(pair, "=")
      Enum.at(key_value, 0) == desired_key && Enum.at(key_value, 1)
    end)
  end
end
```

With an unplanned URL query string format:

```elixir
iex> Extract.get_value("name=Lucas&university=institution=UFMG&lab=ASERG", "university")
"institution"   # <= why not "institution=UFMG"? or only "UFMG"?
```

## Good Example

```elixir
defmodule Extract do
  def get_value(string, desired_key) do
    parts = String.split(string, "&")

    Enum.find_value(parts, fn pair ->
      [key, value] = String.split(pair, "=") # <= pattern matching
      key == desired_key && value
    end)
  end
end
```

With an unplanned URL query string format:

```elixir
iex> Extract.get_value("name=Lucas&university=institution=UFMG&lab=ASERG", "university")
** (MatchError) no match of right hand side value: ["university", "institution", "UFMG"]
```

## Why?

Elixir and pattern matching promote an assertive style of programming where you handle the known cases. Once an unexpected scenario arises, you can decide to address it accordingly based on practical examples, or conclude the scenario is indeed invalid and the exception is the desired choice.

This approach allows clients to decide how to handle these errors and doesn't give a false impression that the code is working correctly when unexpected values are extracted.
