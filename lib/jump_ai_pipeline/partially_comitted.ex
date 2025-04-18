defmodule JumpAiPipeline.PartiallyComitted do
  def old_function(a, b) do
    Enum.count(a) + Enum.count(b)
  end
end
