defmodule JumpAiPipeline.EasyToCoverWithTestsTest do
  use ExUnit.Case
  alias JumpAiPipeline.EasyToCoverWithTests

  describe "sum/2" do
    test "adds two numbers correctly" do
      assert EasyToCoverWithTests.sum(2, 3) == 5
      assert EasyToCoverWithTests.sum(-1, 1) == 0
      assert EasyToCoverWithTests.sum(0, 0) == 0
    end
  end

  describe "multiply/2" do
    test "multiplies two numbers correctly" do
      assert EasyToCoverWithTests.multiply(2, 3) == 6
      assert EasyToCoverWithTests.multiply(-1, 1) == -1
      assert EasyToCoverWithTests.multiply(0, 5) == 0
    end
  end
end