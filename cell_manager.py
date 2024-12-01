import csv
import os

def initialize_csv(rows=5, cols=5, filename='grid.csv'):
    """Initialize CSV file with zeros"""
    with open(filename, 'w', newline='') as file:
        writer = csv.writer(file)
        for _ in range(rows):
            writer.writerow([0] * cols)
    print(f"CSV initialized with {rows}x{cols} grid of zeros")

def update_cell(row, col, response, filename='grid.csv'):
    """Update cell based on user response"""
    # Read current CSV content
    with open(filename, 'r', newline='') as file:
        data = list(csv.reader(file))
    
    # Update the specified cell
    if response.lower() == 'yes':
        data[row][col] = 1
    elif response.lower() == 'no':
        data[row][col] = -1
    else:
        data[row][col] = 0
    
    # Write back to CSV
    with open(filename, 'w', newline='') as file:
        writer = csv.writer(file)
        writer.writerows(data)

def display_grid(filename='grid.csv'):
    """Display current grid state"""
    with open(filename, 'r', newline='') as file:
        reader = csv.reader(file)
        print("\nCurrent Grid State:")
        for row in reader:
            print(row)

def main():
    filename = 'grid.csv'
    
    # Initialize grid if it doesn't exist
    if not os.path.exists(filename):
        rows = int(input("Enter number of rows: "))
        cols = int(input("Enter number of columns: "))
        initialize_csv(rows, cols, filename)
    
    while True:
        display_grid(filename)
        print("\nEnter 'quit' to exit")
        row = input("Enter row number (0-based): ")
        if row.lower() == 'quit':
            break
            
        col = input("Enter column number (0-based): ")
        response = input("Enter response (yes/no/skip): ")
        
        try:
            row, col = int(row), int(col)
            update_cell(row, col, response, filename)
        except (ValueError, IndexError) as e:
            print("Invalid input. Please try again.")

if __name__ == "__main__":
    main()
