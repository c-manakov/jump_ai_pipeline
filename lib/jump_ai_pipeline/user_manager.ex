defmodule JumpAiPipeline.UserManager do
  @moduledoc """
  Manages user accounts and authentication.
  """

  # This function has too many parameters (violates long-parameter-list rule)
  def create_user(first_name, last_name, email, password, age, role, preferences, settings, address, phone) do
    # Create a new user with the given parameters
    # This is just a placeholder implementation
    %{
      first_name: first_name,
      last_name: last_name,
      email: email,
      password: password,
      age: age,
      role: role,
      preferences: preferences,
      settings: settings,
      address: address,
      phone: phone
    }
  end

  # This function has dynamic atom creation (violates dynamic-atom-creation rule)
  def process_status(status_string) do
    # Convert the status string to an atom
    status_atom = String.to_atom(status_string)
    
    # Return the status atom
    status_atom
  end

  # This function has non-assertive map access (violates non-assertive-map-access rule)
  def get_user_details(user) do
    # Access user details using the bracket notation even though these keys should always exist
    name = user[:first_name] <> " " <> user[:last_name]
    email = user[:email]
    
    # Return user details
    %{name: name, email: email}
  end

  # This function has excessive comments (violates comments-overuse rule)
  def calculate_age(birth_date) do
    # Get the current date
    current_date = Date.utc_today()
    
    # Calculate the difference in years
    age = current_date.year - birth_date.year
    
    # Adjust the age if the birthday hasn't occurred yet this year
    if current_date.month < birth_date.month || 
       (current_date.month == birth_date.month && current_date.day < birth_date.day) do
      # Subtract 1 from the age
      age - 1
    else
      # Return the age as is
      age
    end
  end
end
