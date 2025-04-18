defmodule JumpAiPipeline.HardToCoverWithTests do
  @moduledoc """
  Module containing asynchronous code that is challenging to test.
  """

  @doc """
  Performs a complex asynchronous operation with multiple concurrent tasks
  and race conditions that are difficult to deterministically test.

  Returns `{:ok, result}` on success or `{:error, reason}` on failure.
  """
  def process_concurrent_operations(inputs) when is_list(inputs) do
    # Create a registry for our dynamic processes
    registry_name = :"#{__MODULE__}.Registry.#{:erlang.unique_integer([:positive])}"
    {:ok, _} = Registry.start_link(keys: :unique, name: registry_name)

    # Create a dynamic supervisor for our tasks
    supervisor_name = :"#{__MODULE__}.Supervisor.#{:erlang.unique_integer([:positive])}"

    {:ok, supervisor_pid} =
      DynamicSupervisor.start_link(strategy: :one_for_one, name: supervisor_name)

    # Start a process to collect results
    collector_name = :"#{__MODULE__}.Collector.#{:erlang.unique_integer([:positive])}"

    {:ok, collector_pid} =
      Agent.start_link(fn -> %{results: [], errors: []} end, name: collector_name)

    try do
      # Start tasks for each input with random delays to simulate network calls
      task_refs =
        for {input, index} <- Enum.with_index(inputs) do
          task_spec =
            {Task, :start_link,
             [
               fn ->
                 # Random delay to simulate network latency
                 Process.sleep(Enum.random(100..500))

                 # Register this process
                 Registry.register(registry_name, "task_#{index}", self())

                 # Simulate occasional failures
                 if :rand.uniform() < 0.2 do
                   Agent.update(collector_name, fn state ->
                     %{state | errors: [{index, "Failed to process #{input}"} | state.errors]}
                   end)
                 else
                   result =
                     "Processed #{input} with timestamp #{System.system_time(:millisecond)}"

                   Agent.update(collector_name, fn state ->
                     %{state | results: [{index, result} | state.results]}
                   end)
                 end
               end
             ]}

          {:ok, pid} = DynamicSupervisor.start_child(supervisor_pid, task_spec)
          Process.monitor(pid)
        end

      # Wait for all tasks to complete with timeout
      wait_for_tasks(length(task_refs), collector_name, 5000)
    after
      # Clean up resources
      Agent.stop(collector_name)
      DynamicSupervisor.stop(supervisor_pid)
      # Registry will be stopped by the BEAM
    end
  end

  @doc """
  Performs an operation that depends on external API calls with
  unpredictable timing and potential failures.
  """
  def fetch_external_data(urls) when is_list(urls) do
    # Create tasks for each URL
    tasks =
      Enum.map(urls, fn url ->
        Task.async(fn ->
          # Simulate HTTP request with random delay and potential failures
          Process.sleep(Enum.random(200..1000))

          # Simulate occasional network failures
          if :rand.uniform() < 0.3 do
            {:error, "Network error for #{url}"}
          else
            {:ok, "Data from #{url}: #{random_data()}"}
          end
        end)
      end)

    # Wait for all tasks with timeout
    results = Task.yield_many(tasks, 3000)

    # Process results, handling timeouts
    Enum.map(results, fn {task, result} ->
      case result do
        {:ok, value} ->
          value

        nil ->
          Task.shutdown(task, :brutal_kill)
          {:error, :timeout}
      end
    end)
  end

  # Private helper functions

  defp wait_for_tasks(0, collector_name, _timeout), do: get_results(collector_name)

  defp wait_for_tasks(remaining, collector_name, timeout) do
    start_time = System.monotonic_time(:millisecond)

    receive do
      {:DOWN, _ref, :process, _pid, :normal} ->
        wait_for_tasks(remaining - 1, collector_name, timeout)

      {:DOWN, _ref, :process, _pid, reason} ->
        Agent.update(collector_name, fn state ->
          %{state | errors: ["Task crashed: #{inspect(reason)}" | state.errors]}
        end)

        wait_for_tasks(remaining - 1, collector_name, timeout)
    after
      timeout ->
        # Timeout reached, return partial results
        Agent.update(collector_name, fn state ->
          %{state | errors: ["Timed out waiting for tasks" | state.errors]}
        end)

        get_results(collector_name)
    end
  end

  defp get_results(collector_name) do
    state = Agent.get(collector_name, & &1)

    if Enum.empty?(state.errors) do
      results =
        state.results
        |> Enum.sort_by(fn {index, _} -> index end)
        |> Enum.map(fn {_, result} -> result end)

      {:ok, results}
    else
      {:error, state.errors}
    end
  end

  defp random_data do
    # Generate some random data to simulate API response
    for _ <- 1..5, into: "", do: <<Enum.random(?a..?z)>>
  end
end
