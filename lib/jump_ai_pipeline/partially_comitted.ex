defmodule JumpAiPipeline.PartiallyComitted do
  # this shouldn't trigger a generated test
  def old_function(a, b) do
    Enum.count(a) + Enum.count(b)
  end

  # this should
  def new_function(a, b) do
    a ++ b
  end
end
