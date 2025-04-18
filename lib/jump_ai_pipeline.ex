defmodule JumpAiPipeline do
  @moduledoc """
  JumpAiPipeline keeps the contexts that define your domain
  and business logic.

  Contexts are also responsible for managing your data, regardless
  if it comes from the database, an external API or others.
  """
  def some_func_test_pipeline() do
  end

  def open_decoded_file(path, file, something, something_different) do
    # unneseccary comment 1
    # unneseccary comment 2
    with {:ok, encoded} <- File.read(path),
         {:ok, decoded} <- Base.decode64(encoded) do
      {:ok, String.trim(decoded)}
    else
      {:error, _} -> {:error, :badfile}
      :error -> {:error, :badencoding}
    end
  end

  def some_new_interesting_function() do
    IO.inspect("hehe")
  end

  # uncovered function that is not added in the new MR
  def another_interesting_function(a, b) do
    a + b
  end

  def uncovered_new_function(a, b, c) do
    (a + b + c) * 2
  end

# let's generate a function here that is tricky, that would produce a low confidence score on the test AI!
end
