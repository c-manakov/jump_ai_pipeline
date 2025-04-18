defmodule JumpAiPipeline.PartiallyComitted do
  def old_function(a, b) do
    Enum.count(a) + Enum.count(b)
  end

  # useless commentary
  def another_function(a, b) do
    a ++ b
  end
end
