defmodule JumpAiPipeline.EasyToCoverWithTests do
  @moduledoc """
  A collection of simple functions that are easy to test.
  """

  @doc """
  Adds two numbers together.
  
  ## Examples
      iex> JumpAiPipeline.EasyToCoverWithTests.add(1, 2)
      3
  """
  def add(a, b), do: a + b

  @doc """
  Multiplies two numbers together.
  
  ## Examples
      iex> JumpAiPipeline.EasyToCoverWithTests.multiply(2, 3)
      6
  """
  def multiply(a, b), do: a * b

  @doc """
  Divides the first number by the second.
  Raises ArithmeticError if the second number is 0.
  
  ## Examples
      iex> JumpAiPipeline.EasyToCoverWithTests.divide(6, 2)
      3.0
  """
  def divide(a, b) when b != 0, do: a / b
  def divide(_a, 0), do: raise(ArithmeticError, message: "division by zero")

  @doc """
  Checks if a string is a palindrome (reads the same forwards and backwards).
  
  ## Examples
      iex> JumpAiPipeline.EasyToCoverWithTests.palindrome?("racecar")
      true
      
      iex> JumpAiPipeline.EasyToCoverWithTests.palindrome?("hello")
      false
  """
  def palindrome?(str) do
    cleaned = str |> String.downcase() |> String.replace(~r/[^a-z0-9]/, "")
    cleaned == String.reverse(cleaned)
  end

  @doc """
  Filters a list to only include even numbers.
  
  ## Examples
      iex> JumpAiPipeline.EasyToCoverWithTests.filter_even([1, 2, 3, 4, 5])
      [2, 4]
  """
  def filter_even(list) do
    Enum.filter(list, fn x -> rem(x, 2) == 0 end)
  end
end
