# Structs with 32 Fields or More

## Problem

Structs in Elixir are implemented as compile-time maps, which have a predefined amount of fields. When structs have 32 or more fields, their internal representation in the Erlang Virtual Machines changes, potentially leading to bloating and higher memory usage.

## Bad Example

```elixir
defmodule MyExample do
  defstruct [
    :field1,
    :field2,
    # ... many more fields
    :field35
  ]
end
```

## Good Example

Nesting optional fields:

```elixir
defmodule MyExample do
  defstruct [
    :field1,
    :field2,
    # ... fewer than 32 fields
    :metadata # Contains optional fields
  ]
end
```

Or using nested structs:

```elixir
defmodule MyExample do
  defstruct [
    :field1,
    :field2,
    # ... fewer than 32 fields
    :related_data # Contains a nested struct
  ]
end

defmodule MyExample.RelatedData do
  defstruct [
    :field30,
    :field31,
    # ... more fields
  ]
end
```

## Why?

The Erlang VM has two internal representations for maps: a flat map and a hash map. Maps of up to 32 keys are represented as flat maps, which are more memory-efficient. All others are hash maps.

Structs *are* maps (with a metadata field called `__struct__`) and so any struct with fewer than 32 fields is represented as a flat map. This allows several optimizations:

1. When updating a flat map, the tuple keys are shared, reducing memory usage
2. Structs of the same type share the same "tuple keys" at compilation time
3. These optimizations are not available if the struct has 32 keys or more

To remove this anti-pattern, ensure your struct has fewer than 32 fields by:
- Nesting optional fields into a metadata field
- Using nested structs
- Grouping related fields as tuples or other composite data structures
