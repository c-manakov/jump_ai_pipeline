defmodule JumpAiPipeline.PartiallyComittedTest do
  use ExUnit.Case

  alias JumpAiPipeline.PartiallyComitted

  describe "new_function/2" do
    test "concatenates two lists" do
      list1 = [1, 2, 3]
      list2 = [4, 5, 6]
      result = PartiallyComitted.new_function(list1, list2)
      assert result == [1, 2, 3, 4, 5, 6]
    end

    test "works with empty lists" do
      assert PartiallyComitted.new_function([], []) == []
      assert PartiallyComitted.new_function([1, 2], []) == [1, 2]
      assert PartiallyComitted.new_function([], [3, 4]) == [3, 4]
    end
  end
end