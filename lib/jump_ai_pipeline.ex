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

  def complex_async_operation(input, opts \\ []) do
    timeout = Keyword.get(opts, :timeout, 5000)
    retry_count = Keyword.get(opts, :retry_count, 3)
    
    task = Task.async(fn ->
      process_with_retries(input, retry_count)
    end)
    
    case Task.yield(task, timeout) do
      {:ok, result} -> {:ok, result}
      
      nil ->
        Task.shutdown(task)
        {:error, :timeout}
      {:exit, reason} -> {:error, {:crashed, reason}}
    end
  end
  
  defp process_with_retries(input, retries_left, errors \\ [])
  
  defp process_with_retries(_input, 0, errors) do
    {:error, {:max_retries_reached, Enum.reverse(errors)}}
  end
  
  defp process_with_retries(input, retries_left, errors) do
    case do_external_call(input) do
      {:ok, result} -> {:ok, result}
      {:error, reason} ->
        Process.sleep(fibonacci_backoff(retries_left))
        process_with_retries(input, retries_left - 1, [reason | errors])
    end
  end
  
  defp do_external_call(input) do
    # Simulate external API call that might fail
    if :rand.uniform() < 0.3 do
      {:error, :random_failure}
    else
      {:ok, String.upcase(input)}
    end
  end
  
  defp fibonacci_backoff(n) do
    # Calculate Fibonacci number for exponential backoff
    {result, _} = Enum.reduce(1..n, {0, 1}, fn _, {a, b} -> {b, a + b} end)
    result * 100
  end
end
