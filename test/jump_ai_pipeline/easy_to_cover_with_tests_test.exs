defmodule JumpAiPipeline.EasyToCoverWithTestsTest do
  use ExUnit.Case
  alias JumpAiPipeline.EasyToCoverWithTests

  describe "sum/2" do
    test "adds two positive numbers" do
      assert EasyToCoverWithTests.sum(2, 3) == 5
    end

    test "adds positive and negative numbers" do
      assert EasyToCoverWithTests.sum(5, -2) == 3
    end

    test "adds zero and a number" do
      assert EasyToCoverWithTests.sum(0, 10) == 10
    end
  end

  describe "multiply/2" do
    test "multiplies two positive numbers" do
      assert EasyToCoverWithTests.multiply(2, 3) == 6
    end

    test "multiplies positive and negative numbers" do
      assert EasyToCoverWithTests.multiply(5, -2) == -10
    end

    test "multiplies by zero" do
      assert EasyToCoverWithTests.multiply(5, 0) == 0
    end
  end
end