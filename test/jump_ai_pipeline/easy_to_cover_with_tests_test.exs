defmodule JumpAiPipeline.EasyToCoverWithTestsTest do
  use ExUnit.Case, async: true
  doctest JumpAiPipeline.EasyToCoverWithTests

  alias JumpAiPipeline.EasyToCoverWithTests

  describe "add/2" do
    test "adds two positive numbers correctly" do
      assert EasyToCoverWithTests.add(3, 4) == 7
    end

    test "adds a positive and negative number correctly" do
      assert EasyToCoverWithTests.add(10, -5) == 5
    end

    test "adds two negative numbers correctly" do
      assert EasyToCoverWithTests.add(-2, -3) == -5
    end
  end

  describe "multiply/2" do
    test "multiplies two positive numbers correctly" do
      assert EasyToCoverWithTests.multiply(4, 5) == 20
    end

    test "multiplies a positive and negative number correctly" do
      assert EasyToCoverWithTests.multiply(3, -4) == -12
    end

    test "multiplies two negative numbers correctly" do
      assert EasyToCoverWithTests.multiply(-2, -6) == 12
    end

    test "multiplies by zero correctly" do
      assert EasyToCoverWithTests.multiply(5, 0) == 0
    end
  end

  describe "divide/2" do
    test "divides two positive numbers correctly" do
      assert EasyToCoverWithTests.divide(10, 2) == 5.0
    end

    test "divides a positive and negative number correctly" do
      assert EasyToCoverWithTests.divide(15, -3) == -5.0
    end

    test "divides two negative numbers correctly" do
      assert EasyToCoverWithTests.divide(-12, -4) == 3.0
    end

    test "raises an error when dividing by zero" do
      assert_raise ArithmeticError, "division by zero", fn ->
        EasyToCoverWithTests.divide(5, 0)
      end
    end
  end

  describe "palindrome?/1" do
    test "returns true for simple palindromes" do
      assert EasyToCoverWithTests.palindrome?("racecar") == true
      assert EasyToCoverWithTests.palindrome?("madam") == true
    end

    test "returns false for non-palindromes" do
      assert EasyToCoverWithTests.palindrome?("hello") == false
      assert EasyToCoverWithTests.palindrome?("world") == false
    end

    test "ignores case when checking palindromes" do
      assert EasyToCoverWithTests.palindrome?("Racecar") == true
      assert EasyToCoverWithTests.palindrome?("Madam") == true
    end

    test "ignores non-alphanumeric characters" do
      assert EasyToCoverWithTests.palindrome?("A man, a plan, a canal: Panama") == true
    end

    test "handles empty strings" do
      assert EasyToCoverWithTests.palindrome?("") == true
    end
  end

  describe "filter_even/1" do
    test "filters out odd numbers from a list" do
      assert EasyToCoverWithTests.filter_even([1, 2, 3, 4, 5, 6]) == [2, 4, 6]
    end

    test "returns an empty list when no even numbers exist" do
      assert EasyToCoverWithTests.filter_even([1, 3, 5, 7, 9]) == []
    end

    test "returns all numbers when all are even" do
      assert EasyToCoverWithTests.filter_even([2, 4, 6, 8]) == [2, 4, 6, 8]
    end

    test "handles empty lists" do
      assert EasyToCoverWithTests.filter_even([]) == []
    end

    test "handles negative even numbers" do
      assert EasyToCoverWithTests.filter_even([-1, -2, -3, -4]) == [-2, -4]
    end
  end
end