# Complex `else` Clauses in `with`

## Problem

This anti-pattern refers to `with` expressions that flatten all error clauses into a single complex `else` block. This situation is harmful to code readability and maintainability because it's difficult to know from which clause the error value came.

## Bad Example

```elixir
def open_decoded_file(path) do
  with {:ok, encoded} <- File.read(path),
       {:ok, decoded} <- Base.decode64(encoded) do
    {:ok, String.trim(decoded)}
  else
    {:error, _} -> {:error, :badfile}
    :error -> {:error, :badencoding}
  end
end
```

In the code above, it is unclear how each pattern on the left side of `<-` relates to their error at the end. The more patterns in a `with`, the less clear the code gets, and the more likely it is that unrelated failures will overlap each other.

## Good Example

```elixir
def open_decoded_file(path) do
  with {:ok, encoded} <- file_read(path),
       {:ok, decoded} <- base_decode64(encoded) do
    {:ok, String.trim(decoded)}
  end
end

defp file_read(path) do
  case File.read(path) do
    {:ok, contents} -> {:ok, contents}
    {:error, _} -> {:error, :badfile}
  end
end

defp base_decode64(contents) do
  case Base.decode64(contents) do
    {:ok, decoded} -> {:ok, decoded}
    :error -> {:error, :badencoding}
  end
end
```

## Why?

Instead of concentrating all error handling within a single complex `else` block, it is better to normalize the return types in specific private functions. This way, `with` can focus on the success case and the errors are normalized closer to where they happen, leading to better organized and maintainable code.
