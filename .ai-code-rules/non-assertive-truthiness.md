# Non-Assertive Truthiness

## Problem

Elixir provides the concept of truthiness: `nil` and `false` are considered "falsy" and all other values are "truthy". Many constructs in the language, such as `&&/2`, `||/2`, and `!/1` handle truthy and falsy values.

Using those operators is not an anti-pattern. However, using those operators when all operands are expected to be booleans, may be an anti-pattern.

## Bad Example

```elixir
if is_binary(name) && is_integer(age) do
  # ...
else
  # ...
end
```

Given both operands of `&&/2` are booleans, the code is more generic than necessary, and potentially unclear.

## Good Example

```elixir
if is_binary(name) and is_integer(age) do
  # ...
else
  # ...
end
```

## Why?

To remove this anti-pattern, we can replace `&&/2`, `||/2`, and `!/1` by `and/2`, `or/2`, and `not/1` respectively. These operators assert at least their first argument is a boolean.

This technique may be particularly important when working with Erlang code. Erlang does not have the concept of truthiness. It never returns `nil`, instead its functions may return `:error` or `:undefined` in places an Elixir developer would return `nil`.

Therefore, to avoid accidentally interpreting `:undefined` or `:error` as a truthy value, you may prefer to use `and/2`, `or/2`, and `not/1` exclusively when interfacing with Erlang APIs.
