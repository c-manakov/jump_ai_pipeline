# Namespace Trespassing

## Problem

This anti-pattern manifests when a package author or a library defines modules outside of its "namespace". A library should use its name as a "prefix" for all of its modules. For example, a package named `:my_lib` should define all of its modules within the `MyLib` namespace, such as `MyLib.User`, `MyLib.SubModule`, `MyLib.Application`, and `MyLib` itself.

This is important because the Erlang VM can only load one instance of a module at a time. So if there are multiple libraries that define the same module, then they are incompatible with each other due to this limitation.

## Bad Example

Imagine you are writing a package that adds authentication to [Plug](https://github.com/elixir-plug/plug) called `:plug_auth`. You must avoid defining modules within the `Plug` namespace:

```elixir
defmodule Plug.Auth do
  # ...
end
```

## Good Example

Given the package is named `:plug_auth`, it must define modules inside the `PlugAuth` namespace:

```elixir
defmodule PlugAuth do
  # ...
end
```

## Why?

By always using the library name as a prefix, it avoids module name clashes due to the unique prefix. Even if `Plug` does not currently define a `Plug.Auth` module, it may add such a module in the future, which would ultimately conflict with `plug_auth`'s definition.

There are few known exceptions to this anti-pattern:
- Protocol implementations are, by design, defined under the protocol namespace
- In some scenarios, the namespace owner may allow exceptions to this rule (e.g., custom Mix tasks)
- If you are the maintainer for both libraries, you may allow one to define modules in the other's namespace
