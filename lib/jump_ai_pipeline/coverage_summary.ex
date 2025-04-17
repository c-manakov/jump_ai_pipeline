defmodule JumpAiPipeline.CoverageSummary do
  @moduledoc """
  Provides functions to generate and print coverage summaries.
  """

  @doc """
  Prints a summary of the test coverage to stdout.
  """
  def print do
    coverage_files = Path.wildcard("cover/default.coverdata")

    if Enum.empty?(coverage_files) do
      IO.puts("No coverage data found. Run tests with coverage first.")
      System.halt(1)
    end

    # Import the coverage data
    :cover.start()
    Enum.each(coverage_files, &:cover.import/1)

    # Get all modules
    all_modules = :cover.modules()

    IO.inspect(all_modules)

    # Print header
    IO.puts("\nCoverage Summary:")
    IO.puts("----------------")

    # Calculate and print coverage for each module
    total_covered = 0
    total_total = 0

    module_results =
      Enum.map(all_modules, fn module ->
        {covered, total} =
          case :cover.analyse(module, :coverage, :module) do
            {:ok, {_, {c, t}}} -> {c, t}
            _ -> {0, 0}
          end

        dbg()

        total_covered = total_covered + covered
        total_total = total_total + total

        percentage = if total > 0, do: covered / total * 100, else: 0.0

        # Print module coverage
        module_name = module |> to_string() |> String.replace_prefix("Elixir.", "")
        IO.puts("#{module_name}: #{Float.round(percentage, 2)}%")

        {module_name, percentage}
      end)

    # Print total coverage
    total_percentage = if total_total > 0, do: total_covered / total_total * 100, else: 0.0
    IO.puts("\nTotal: #{Float.round(total_percentage, 2)}%")

    # Return the results
    {total_percentage, module_results}
  end
end
