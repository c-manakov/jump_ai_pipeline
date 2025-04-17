# Dynamic Atom Creation

## Problem

An `Atom` is an Elixir basic type whose value is its own name. Atoms are often useful to identify resources or express the state, or result, of an operation. Creating atoms dynamically is not an anti-pattern by itself. However, atoms are not garbage collected by the Erlang Virtual Machine, so values of this type live in memory during a software's entire execution lifetime.

The Erlang VM limits the number of atoms that can exist in an application by default to *1_048_576*, which is more than enough to cover all atoms defined in a program, but attempts to serve as an early limit for applications which are "leaking atoms" through dynamic creation.

For these reasons, creating atoms dynamically can be considered an anti-pattern when the developer has no control over how many atoms will be created during the software execution.

## Bad Example

```elixir
defmodule MyRequestHandler do
  def parse(%{"status" => status, "message" => message} = _payload) do
    %{status: String.to_atom(status), message: message}
  end
end
```

When we use the `String.to_atom/1` function to dynamically create an atom, it essentially gains potential access to create arbitrary atoms in our system, causing us to lose control over adhering to the limits established by the BEAM.

## Good Example

```elixir
defmodule MyRequestHandler do
  def parse(%{"status" => status, "message" => message} = _payload) do
    %{status: convert_status(status), message: message}
  end

  defp convert_status("ok"), do: :ok
  defp convert_status("error"), do: :error
  defp convert_status("redirect"), do: :redirect
end
```

Or using `String.to_existing_atom/1`:

```elixir
defmodule MyRequestHandler do
  def parse(%{"status" => status, "message" => message} = _payload) do
    %{status: String.to_existing_atom(status), message: message}
  end
  
  def valid_statuses do
    [:ok, :error, :redirect]
  end
end
```

## Why?

To eliminate this anti-pattern, developers must either:
1. Perform explicit conversions by mapping strings to atoms
2. Replace the use of `String.to_atom/1` with `String.to_existing_atom/1`

By explicitly listing all supported statuses or using `String.to_existing_atom/1`, you guarantee only a limited number of conversions may happen, preventing potential memory issues or system crashes.
