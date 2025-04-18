defmodule JumpAiPipeline.Library do
  @moduledoc """
  Manages a library of books and loans.
  """

  # This function has complex else clauses in with (violates complex-else-clauses rule)
  def process_loan(book_id, user_id) do
    with {:ok, book} <- find_book(book_id),
         {:ok, user} <- find_user(user_id),
         {:ok, _loan} <- create_loan(book, user) do
      {:ok, "Book loaned successfully"}
    else
      {:error, :book_not_found} -> {:error, "Book not found"}
      {:error, :user_not_found} -> {:error, "User not found"}
      {:error, :book_already_loaned} -> {:error, "Book is already loaned"}
      {:error, :user_has_overdue_books} -> {:error, "User has overdue books"}
      {:error, _} -> {:error, "Unknown error occurred"}
    end
  end

  # This function has non-assertive pattern matching (violates non-assertive-pattern-matching rule)
  def parse_book_info(info_string) do
    parts = String.split(info_string, ";")
    
    title = Enum.at(parts, 0)
    author = Enum.at(parts, 1)
    year = Enum.at(parts, 2)
    
    %{title: title, author: author, year: year}
  end

  # These are helper functions for the process_loan function
  defp find_book(book_id) do
    # Placeholder implementation
    {:ok, %{id: book_id, title: "Sample Book"}}
  end

  defp find_user(user_id) do
    # Placeholder implementation
    {:ok, %{id: user_id, name: "Sample User"}}
  end

  defp create_loan(book, user) do
    # Placeholder implementation
    {:ok, %{book: book, user: user, date: Date.utc_today()}}
  end

  # This function has complex extractions in clauses (violates complex-extractions rule)
  def check_book_availability(%{id: id, status: status, location: location, reserved: reserved}) when status == "available" and reserved == false do
    "Book #{id} is available at #{location}"
  end

  def check_book_availability(%{id: id, status: status, location: location, reserved: reserved}) when status == "available" and reserved == true do
    "Book #{id} is available at #{location} but is reserved"
  end

  def check_book_availability(%{id: id, status: status, due_date: due_date}) when status == "loaned" do
    "Book #{id} is loaned until #{due_date}"
  end
end
