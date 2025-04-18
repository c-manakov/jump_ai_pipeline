defmodule JumpAiPipeline.PartiallyComittedTest do
  use ExUnit.Case
  alias JumpAiPipeline.PartiallyComitted

  describe "another_function/2" do
    test "concatenates two lists" do
      assert PartiallyComitted.another_function([1, 2], [3, 4]) == [1, 2, 3, 4]
    end

    test "works with empty lists" do
      assert PartiallyComitted.another_function([], []) == []
      assert PartiallyComitted.another_function([], [1, 2]) == [1, 2]
      assert PartiallyComitted.another_function([1, 2], []) == [1, 2]
    end

    test "works with non-integer elements" do
      assert PartiallyComitted.another_function([:a, :b], [:c]) == [:a, :b, :c]
      assert PartiallyComitted.another_function(["a"], ["b"]) == ["a", "b"]
    end
  end
end