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
    Enum.map(coverage_files, &:cover.import/1)

    # Get all modules
    all_modules = :cover.imported_modules()

    # Print header
    IO.puts("\nCoverage Summary:")
    IO.puts("----------------")

    # Calculate and print coverage for each module
    {total_covered, total_total} =
      Enum.reduce(all_modules, {0, 0}, fn module, {acc_covered, acc_total} ->
        {covered, total} =
          case :cover.analyse(module, :coverage, :module) do
            {:ok, {_, {c, t}}} -> {c, t}
            _ -> {0, 0}
          end

        {acc_covered + covered, acc_total + total}
      end)

    module_results =
      Enum.map(all_modules, fn module ->
        {covered, total} =
          case :cover.analyse(module, :coverage, :module) do
            {:ok, {_, {c, t}}} -> {c, t}
            _ -> {0, 0}
          end

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

  @doc """
  Exports line-by-line coverage data as JSON.
  """
  def export_json(output_path \\ "cover/coverage.json") do
    coverage_files = Path.wildcard("cover/default.coverdata")

    if Enum.empty?(coverage_files) do
      IO.puts("No coverage data found. Run tests with coverage first.")
      System.halt(1)
    end

    # Import the coverage data
    :cover.start()
    Enum.map(coverage_files, &:cover.import/1)

    # Get all modules
    all_modules = :cover.imported_modules()

    # Collect line-by-line coverage data for each module
    coverage_data = 
      Enum.map(all_modules, fn module ->
        # Extract file path from module's compile info
        source_path = case Keyword.get(module.__info__(:compile), :source) do
          nil -> ""
          path -> 
            path
            |> to_string()
            |> String.replace_prefix(File.cwd!() <> "/", "")
        end
        
        module_name = module |> to_string() |> String.replace_prefix("Elixir.", "")
        
        
        # Get line-by-line coverage
        case :cover.analyse(module, :coverage, :line) do
          {:ok, lines} ->
            dbg(lines)
            # Convert to more compact format: [[line_number, covered?], ...]
            lines_data = Enum.map(lines, fn {{_, line_num}, {covered?, _}} ->
              [line_num, covered? == 1]
            end)
            
            # Calculate module coverage percentage
            {covered, total} =
              case :cover.analyse(module, :coverage, :module) do
                {:ok, {_, {c, t}}} -> {c, t}
                _ -> {0, 0}
              end
            
            percentage = if total > 0, do: covered / total * 100, else: 0.0
            
            %{
              module: module_name,
              file: source_path,
              coverage_percentage: Float.round(percentage, 2),
              covered_lines: covered,
              total_lines: total,
              lines: lines_data
            }
          _ ->
            %{
              module: module_name,
              file: source_path,
              coverage_percentage: 0.0,
              covered_lines: 0,
              total_lines: 0,
              lines: []
            }
        end
      end)
    
    # Create the output directory if it doesn't exist
    output_dir = Path.dirname(output_path)
    File.mkdir_p!(output_dir)
    
    # Write the JSON file
    json_content = Jason.encode!(coverage_data, pretty: true)
    File.write!(output_path, json_content)
    
    IO.puts("Coverage data exported to #{output_path}")
    
    coverage_data
  end
end
