defmodule JumpAiPipeline.PartiallyComittedTest do
  use ExUnit.Case
  alias JumpAiPipeline.PartiallyComitted

  describe "new_function/2" do
    test "concatenates two lists" do
      assert PartiallyComitted.new_function([1, 2], [3, 4]) == [1, 2, 3, 4]
    end

    test "works with empty lists" do
      assert PartiallyComitted.new_function([], []) == []
      assert PartiallyComitted.new_function([1, 2], []) == [1, 2]
      assert PartiallyComitted.new_function([], [3, 4]) == [3, 4]
    end
  end
end