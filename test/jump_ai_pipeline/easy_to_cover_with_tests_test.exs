defmodule JumpAiPipeline.EasyToCoverWithTestsTest do
  use ExUnit.Case
  alias JumpAiPipeline.EasyToCoverWithTests

  describe "sum/2" do
    test "adds two positive numbers correctly" do
      assert EasyToCoverWithTests.sum(2, 3) == 5
    end

    test "handles negative numbers" do
      assert EasyToCoverWithTests.sum(-1, -2) == -3
      assert EasyToCoverWithTests.sum(-5, 10) == 5
    end

    test "handles zero" do
      assert EasyToCoverWithTests.sum(0, 5) == 5
      assert EasyToCoverWithTests.sum(5, 0) == 5
      assert EasyToCoverWithTests.sum(0, 0) == 0
    end
  end

  describe "multiply/2" do
    test "multiplies two positive numbers correctly" do
      assert EasyToCoverWithTests.multiply(2, 3) == 6
    end

    test "handles negative numbers" do
      assert EasyToCoverWithTests.multiply(-1, -2) == 2
      assert EasyToCoverWithTests.multiply(-5, 10) == -50
    end

    test "handles zero" do
      assert EasyToCoverWithTests.multiply(0, 5) == 0
      assert EasyToCoverWithTests.multiply(5, 0) == 0
      assert EasyToCoverWithTests.multiply(0, 0) == 0
    end
  end
end