defmodule JumpAiPipeline do
  @moduledoc """
  JumpAiPipeline keeps the contexts that define your domain
  and business logic.

  Contexts are also responsible for managing your data, regardless
  if it comes from the database, an external API or others.
  """
  def some_func_test_pipeline() do
  end

  def open_decoded_file(path) do
    with {:ok, encoded} <- File.read(path),
         {:ok, decoded} <- Base.decode64(encoded) do
      {:ok, String.trim(decoded)}
# this is a complex else statement
    else
      {:error, _} -> {:error, :badfile}
      :error -> {:error, :badencoding}
    end
  end
end
